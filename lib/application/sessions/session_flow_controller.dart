import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:path/path.dart' as path;

import '../../domain/models/app_user.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/services/learning_repository.dart';
import '../../domain/services/pipeline_services.dart';
import '../../domain/services/study_session_pipeline_service.dart';
import 'session_flow_state.dart';

class SessionFlowController extends StateNotifier<SessionFlowState> {
  SessionFlowController({
    required AppUser currentUser,
    required LearningRepository learningRepository,
    required RecordingDeviceService recordingDeviceService,
    required StudySessionPipelineService studySessionPipelineService,
  }) : _currentUser = currentUser,
       _learningRepository = learningRepository,
       _recordingDeviceService = recordingDeviceService,
       _studySessionPipelineService = studySessionPipelineService,
       super(const SessionFlowState.initial());

  final AppUser _currentUser;
  final LearningRepository _learningRepository;
  final RecordingDeviceService _recordingDeviceService;
  final StudySessionPipelineService _studySessionPipelineService;

  Timer? _readingTicker;
  Timer? _recallTicker;
  DateTime? _readingStartedAt;
  DateTime? _recallStartedAt;
  Duration _readingBase = Duration.zero;
  Duration _recallBase = Duration.zero;

  bool get recorderSupported => _recordingDeviceService.isSupported;

  Future<void> importPastedText({
    required String title,
    required String subtitle,
    required String text,
  }) async {
    state = state.copyWith(
      isImporting: true,
      statusMessage: 'Parsing pasted text into study-ready sections...',
      clearErrorMessage: true,
    );

    try {
      final source = await _studySessionPipelineService.importDocument(
        user: _currentUser,
        sourceType: LearningSourceType.text,
        title: title,
        subtitle: subtitle,
        rawText: text,
      );
      await _learningRepository.upsertSource(source);
      state = state.copyWith(
        isImporting: false,
        statusMessage:
            'Source imported. Pick the exact section you want to study today.',
      );
    } catch (error) {
      _setError('Could not import the pasted text.', error);
    }
  }

  Future<void> importFromFilePicker() async {
    state = state.copyWith(
      isImporting: true,
      statusMessage: 'Preparing file import...',
      clearErrorMessage: true,
    );

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'txt'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        state = state.copyWith(
          isImporting: false,
          statusMessage: 'Import cancelled.',
        );
        return;
      }

      final file = result.files.single;
      final extension = path.extension(file.name).toLowerCase();
      final sourceType = extension == '.pdf'
          ? LearningSourceType.pdf
          : LearningSourceType.text;

      final fileBytes = file.bytes;
      if (fileBytes == null || fileBytes.isEmpty) {
        throw StateError(
          'The selected file could not be read. Try a smaller file or paste the text directly.',
        );
      }

      final rawText = extension == '.txt'
          ? utf8.decode(fileBytes, allowMalformed: true)
          : null;

      final source = await _studySessionPipelineService.importDocument(
        user: _currentUser,
        sourceType: sourceType,
        title: path.basenameWithoutExtension(file.name),
        subtitle: extension == '.pdf'
            ? 'Uploaded document'
            : 'Imported text file',
        rawText: rawText,
        fileBytes: extension == '.pdf' ? fileBytes : null,
        fileName: file.name,
      );
      await _learningRepository.upsertSource(source);

      state = state.copyWith(
        isImporting: false,
        statusMessage: 'File imported. Choose a section and create a session.',
      );
    } catch (error) {
      _setError('Could not import the selected file.', error);
    }
  }

  Future<void> createSession({
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  }) async {
    try {
      final session = await _studySessionPipelineService.createSession(
        user: _currentUser,
        source: source,
        section: section,
        mode: mode,
      );
      await _learningRepository.upsertSession(session);
      _readingBase = Duration.zero;
      _recallBase = Duration.zero;
      _startReadingTicker();

      state = state.copyWith(
        activeSession: session,
        readingElapsed: Duration.zero,
        recallElapsed: Duration.zero,
        clearPendingRecallAudio: true,
        clearLastGeneratedNoteId: true,
        clearErrorMessage: true,
        statusMessage:
            'Read first. When you finish, the document disappears and recall starts from memory only.',
      );
    } catch (error) {
      _setError('Could not create the study session.', error);
    }
  }

  Future<void> markReadingComplete() async {
    final session = state.activeSession;
    if (session == null || session.phase != LearningSessionPhase.reading) {
      return;
    }

    _stopReadingTicker();
    final updated = session.copyWith(
      phase: LearningSessionPhase.readyToRecall,
      actualReadDuration: state.readingElapsed,
      updatedAt: DateTime.now(),
      clearErrorMessage: true,
    );
    await _learningRepository.upsertSession(updated);
    state = state.copyWith(
      activeSession: updated,
      statusMessage:
          'The reading is hidden now. Explain what you read in your own words as if you were making oral notes.',
    );
  }

  Future<void> startRecallRecording() async {
    final session = state.activeSession;
    if (session == null ||
        session.phase != LearningSessionPhase.readyToRecall ||
        !_recordingDeviceService.isSupported) {
      return;
    }

    try {
      await _recordingDeviceService.start(sessionId: session.id);
      _recallBase = Duration.zero;
      _startRecallTicker();

      final updated = session.copyWith(
        phase: LearningSessionPhase.recordingRecall,
        updatedAt: DateTime.now(),
        clearErrorMessage: true,
      );
      await _learningRepository.upsertSession(updated);
      state = state.copyWith(
        activeSession: updated,
        recallElapsed: Duration.zero,
        statusMessage:
            'Retell it naturally. Aim for key ideas, correct definitions, terms, examples, and edge cases.',
      );
    } catch (error) {
      _setError('Could not start recall recording.', error);
    }
  }

  Future<void> stopRecallRecording() async {
    final session = state.activeSession;
    if (session == null ||
        session.phase != LearningSessionPhase.recordingRecall) {
      return;
    }

    try {
      _stopRecallTicker();
      final audio = await _recordingDeviceService.stop(
        duration: state.recallElapsed,
      );
      final updated = session.copyWith(
        phase: LearningSessionPhase.reviewRecording,
        updatedAt: DateTime.now(),
        clearErrorMessage: true,
      );
      await _learningRepository.upsertSession(updated);
      state = state.copyWith(
        activeSession: updated,
        pendingRecallAudio: audio,
        statusMessage:
            'Good. Submit this attempt to score the recall against the document.',
      );
    } catch (error) {
      _setError('Could not finalize recall recording.', error);
    }
  }

  Future<void> discardRecallAttempt() async {
    await _recordingDeviceService.cancel();
    _stopRecallTicker();
    final session = state.activeSession;
    if (session == null) {
      return;
    }
    final updated = session.copyWith(
      phase: LearningSessionPhase.readyToRecall,
      updatedAt: DateTime.now(),
      clearErrorMessage: true,
    );
    await _learningRepository.upsertSession(updated);
    state = state.copyWith(
      activeSession: updated,
      recallElapsed: Duration.zero,
      clearPendingRecallAudio: true,
      statusMessage: 'Attempt discarded. Record again when ready.',
    );
  }

  Future<void> submitRecallAttempt() async {
    final session = state.activeSession;
    final audio = state.pendingRecallAudio;

    if (session == null ||
        audio == null ||
        session.phase != LearningSessionPhase.reviewRecording) {
      return;
    }

    try {
      final transcribingSession = session.copyWith(
        phase: LearningSessionPhase.transcribing,
        updatedAt: DateTime.now(),
        clearErrorMessage: true,
      );
      await _learningRepository.upsertSession(transcribingSession);
      state = state.copyWith(
        activeSession: transcribingSession,
        isWorking: true,
        statusMessage:
            'Turning the oral retelling into text and scoring it against the source...',
        clearErrorMessage: true,
      );

      final evaluatedSession = await _studySessionPipelineService
          .evaluateRecallAudio(
            user: _currentUser,
            session: transcribingSession,
            recording: audio,
            actualReadDuration: state.readingElapsed,
          );
      await _learningRepository.upsertSession(evaluatedSession);

      state = state.copyWith(
        activeSession: evaluatedSession,
        isWorking: false,
        clearPendingRecallAudio: true,
        statusMessage: evaluatedSession.feedback?.canPass ?? false
            ? 'You passed the recall gate. Generate the corrected note when ready.'
            : 'Retry recommended. The recall is still missing too much of the source.',
      );
    } catch (error) {
      _setError('Could not evaluate this recall attempt.', error);
    }
  }

  Future<void> retryRecall() async {
    final session = state.activeSession;
    if (session == null) {
      return;
    }

    final updated = session.copyWith(
      phase: LearningSessionPhase.readyToRecall,
      clearRecallTranscript: true,
      clearFeedback: true,
      updatedAt: DateTime.now(),
      clearErrorMessage: true,
    );
    await _learningRepository.upsertSession(updated);

    state = state.copyWith(
      activeSession: updated,
      recallElapsed: Duration.zero,
      clearPendingRecallAudio: true,
      statusMessage: 'Go again. Focus on what you missed last time.',
    );
  }

  Future<void> passAndGenerateNote() async {
    final session = state.activeSession;
    final feedback = session?.feedback;

    if (session == null || feedback == null || !feedback.canPass) {
      return;
    }

    try {
      final generatingSession = session.copyWith(
        phase: LearningSessionPhase.generatingNote,
        updatedAt: DateTime.now(),
        clearErrorMessage: true,
      );
      await _learningRepository.upsertSession(generatingSession);
      state = state.copyWith(
        activeSession: generatingSession,
        isWorking: true,
        statusMessage:
            'Building a corrected study note from the retelling plus the source...',
      );

      final result = await _studySessionPipelineService.generateNote(
        user: _currentUser,
        session: generatingSession,
      );
      await _learningRepository.upsertSession(result.session);

      state = state.copyWith(
        activeSession: result.session,
        isWorking: false,
        lastGeneratedNoteId: result.note.id,
        statusMessage:
            'Session complete. Your corrected note is saved for review.',
      );
    } catch (error) {
      _setError('Could not generate the review note.', error);
    }
  }

  Future<void> clearActiveSession() async {
    _stopReadingTicker();
    _stopRecallTicker();
    state = state.copyWith(
      clearActiveSession: true,
      readingElapsed: Duration.zero,
      recallElapsed: Duration.zero,
      clearPendingRecallAudio: true,
      statusMessage:
          'Upload a document, read a focused section, then prove you learned it.',
    );
  }

  void _startReadingTicker() {
    _stopReadingTicker();
    _readingStartedAt = DateTime.now();
    _readingTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      final startedAt = _readingStartedAt;
      final session = state.activeSession;
      if (startedAt == null || session == null) {
        return;
      }

      final elapsed = _readingBase + DateTime.now().difference(startedAt);
      state = state.copyWith(readingElapsed: elapsed);
    });
  }

  void _startRecallTicker() {
    _stopRecallTicker();
    _recallStartedAt = DateTime.now();
    _recallTicker = Timer.periodic(const Duration(milliseconds: 300), (_) {
      final startedAt = _recallStartedAt;
      if (startedAt == null) {
        return;
      }

      final elapsed = _recallBase + DateTime.now().difference(startedAt);
      state = state.copyWith(recallElapsed: elapsed);
    });
  }

  void _stopReadingTicker() {
    final startedAt = _readingStartedAt;
    if (startedAt != null) {
      _readingBase += DateTime.now().difference(startedAt);
    }
    _readingTicker?.cancel();
    _readingTicker = null;
    _readingStartedAt = null;
  }

  void _stopRecallTicker() {
    final startedAt = _recallStartedAt;
    if (startedAt != null) {
      _recallBase += DateTime.now().difference(startedAt);
    }
    _recallTicker?.cancel();
    _recallTicker = null;
    _recallStartedAt = null;
  }

  void _setError(String message, Object error) {
    _stopReadingTicker();
    _stopRecallTicker();
    state = state.copyWith(
      isImporting: false,
      isWorking: false,
      statusMessage: message,
      errorMessage: error.toString(),
      activeSession: state.activeSession?.copyWith(
        phase: LearningSessionPhase.error,
        errorMessage: error.toString(),
        updatedAt: DateTime.now(),
      ),
    );
  }

  @override
  void dispose() {
    _stopReadingTicker();
    _stopRecallTicker();
    super.dispose();
  }
}
