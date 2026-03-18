import 'dart:async';

import 'package:collection/collection.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:path/path.dart' as path;
import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/learning_repository.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/pipeline_services.dart';
import 'session_flow_state.dart';

class SessionFlowController extends StateNotifier<SessionFlowState> {
  SessionFlowController({
    required AppUser currentUser,
    required LearningRepository learningRepository,
    required NotesRepository notesRepository,
    required RecordingDeviceService recordingDeviceService,
    required AudioStorageService audioStorageService,
    required TranscriptionService transcriptionService,
    required DocumentParsingService documentParsingService,
    required RecallEvaluationService recallEvaluationService,
    required SessionNoteSynthesisService sessionNoteSynthesisService,
    required KnowledgeOrganizationService knowledgeOrganizationService,
    required RelatedNotesService relatedNotesService,
  }) : _currentUser = currentUser,
       _learningRepository = learningRepository,
       _notesRepository = notesRepository,
       _recordingDeviceService = recordingDeviceService,
       _audioStorageService = audioStorageService,
       _transcriptionService = transcriptionService,
       _documentParsingService = documentParsingService,
       _recallEvaluationService = recallEvaluationService,
       _sessionNoteSynthesisService = sessionNoteSynthesisService,
       _knowledgeOrganizationService = knowledgeOrganizationService,
       _relatedNotesService = relatedNotesService,
       super(const SessionFlowState.initial());

  final _uuid = const Uuid();
  final AppUser _currentUser;
  final LearningRepository _learningRepository;
  final NotesRepository _notesRepository;
  final RecordingDeviceService _recordingDeviceService;
  final AudioStorageService _audioStorageService;
  final TranscriptionService _transcriptionService;
  final DocumentParsingService _documentParsingService;
  final RecallEvaluationService _recallEvaluationService;
  final SessionNoteSynthesisService _sessionNoteSynthesisService;
  final KnowledgeOrganizationService _knowledgeOrganizationService;
  final RelatedNotesService _relatedNotesService;

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
      final source = await _documentParsingService.importSource(
        user: _currentUser,
        sourceType: LearningSourceType.text,
        title: title,
        subtitle: subtitle,
        rawText: text,
      );
      await _learningRepository.upsertSource(source);
      state = state.copyWith(
        isImporting: false,
        statusMessage: 'Source imported. Choose a section and start a session.',
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
      String? rawText;

      if (extension == '.txt') {
        if (file.bytes != null) {
          rawText = String.fromCharCodes(file.bytes!);
        }
      }

      final source = await _documentParsingService.importSource(
        user: _currentUser,
        sourceType: extension == '.pdf'
            ? LearningSourceType.pdf
            : LearningSourceType.text,
        title: path.basenameWithoutExtension(file.name),
        subtitle: extension == '.pdf'
            ? 'Uploaded document'
            : 'Imported text file',
        rawText: rawText,
        fileName: file.name,
      );
      await _learningRepository.upsertSource(source);

      state = state.copyWith(
        isImporting: false,
        statusMessage: 'File imported. Pick a chapter or section to learn.',
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
    final session = LearningSession(
      id: _uuid.v4(),
      userId: _currentUser.id,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceType: source.type,
      sectionId: section.id,
      sectionTitle: section.title,
      mode: mode,
      phase: LearningSessionPhase.reading,
      sourceText: section.extractedText,
      targetReadDuration: Duration(minutes: section.estimatedReadMinutes),
      actualReadDuration: Duration.zero,
      attemptCount: 0,
      recallPrompt: _promptForMode(mode),
      recallTranscript: null,
      feedback: null,
      noteId: null,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      errorMessage: null,
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
      );
      await _learningRepository.upsertSession(updated);
      state = state.copyWith(
        activeSession: updated,
        pendingRecallAudio: audio,
        statusMessage: 'Good. Submit this attempt to score the recall against the document.',
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
        attemptCount: session.attemptCount + 1,
        updatedAt: DateTime.now(),
      );
      await _learningRepository.upsertSession(transcribingSession);
      state = state.copyWith(
        activeSession: transcribingSession,
        isWorking: true,
        statusMessage: 'Turning the oral retelling into text...',
        clearErrorMessage: true,
      );

      final stored = await _audioStorageService.upload(
        user: _currentUser,
        recording: audio,
      );
      final transcript = await _transcriptionService.transcribe(
        user: _currentUser,
        audio: stored,
        duration: audio.duration,
      );

      final evaluatingSession = transcribingSession.copyWith(
        phase: LearningSessionPhase.evaluating,
        recallTranscript: transcript.text,
        updatedAt: DateTime.now(),
      );
      await _learningRepository.upsertSession(evaluatingSession);
      state = state.copyWith(
        activeSession: evaluatingSession,
        statusMessage: 'Comparing the retelling against the source material...',
      );

      final feedback = await _recallEvaluationService.evaluate(
        session: evaluatingSession,
        recallTranscript: transcript.text,
      );

      final feedbackSession = evaluatingSession.copyWith(
        phase: LearningSessionPhase.feedbackReady,
        feedback: feedback,
        updatedAt: DateTime.now(),
      );
      await _learningRepository.upsertSession(feedbackSession);

      state = state.copyWith(
        activeSession: feedbackSession,
        isWorking: false,
        clearPendingRecallAudio: true,
        statusMessage: feedback.canPass
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
      );
      await _learningRepository.upsertSession(generatingSession);
      state = state.copyWith(
        activeSession: generatingSession,
        isWorking: true,
        statusMessage: 'Building a corrected study note from the retelling plus the source...',
      );

      final generated = await _sessionNoteSynthesisService.synthesize(
        session: generatingSession,
        feedback: feedback,
      );

      final folders = await _notesRepository.listFolders(_currentUser.id);
      final existingNotes = await _notesRepository.listNotes(_currentUser.id);

      final organizationPlan = await _knowledgeOrganizationService.organize(
        context: KnowledgeOrganizationContext(
          user: _currentUser,
          generatedNote: generated,
          existingFolders: folders,
          existingNotes: existingNotes,
        ),
      );

      FolderEntity? folder = folders
          .where(
            (candidate) =>
                candidate.title.toLowerCase() ==
                organizationPlan.folderTitle.toLowerCase(),
          )
          .firstOrNull;

      if (folder == null && organizationPlan.createNewFolder) {
        folder = FolderEntity(
          id: _uuid.v4(),
          userId: _currentUser.id,
          title: organizationPlan.folderTitle,
          description: organizationPlan.folderDescription,
          parentFolderId: null,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
          aiGenerated: true,
        );
        await _notesRepository.upsertFolder(folder);
      }

      final note = StudyNote(
        id: _uuid.v4(),
        userId: _currentUser.id,
        folderId: folder?.id,
        sourceAudioUrl: null,
        rawTranscript: session.recallTranscript ?? '',
        cleanedTitle: generated.title,
        cleanedSummary: generated.summary,
        cleanedContent: generated.cleanedContent,
        keyIdeas: generated.keyIdeas,
        reviewQuestions: generated.reviewQuestions,
        keyTerms: generated.importantTerms,
        tags: {...generated.tags, ...organizationPlan.tags}.toList()..sort(),
        topics: {...generated.topics, ...organizationPlan.topics}.toList()
          ..sort(),
        relatedNoteIds: const [],
        aiProcessingStatus: NoteProcessingStatus.ready,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        sourceDuration: state.recallElapsed,
      );

      final relatedMatches = await _relatedNotesService.findRelated(
        context: RelatedNotesContext(
          currentNote: note,
          existingNotes: existingNotes,
        ),
      );

      final finalNote = note.copyWith(
        relatedNoteIds: relatedMatches.map((match) => match.noteId).toList(),
      );
      await _notesRepository.upsertNote(finalNote);
      await _notesRepository
          .replaceLinksForNote(_currentUser.id, finalNote.id, [
            for (final match in relatedMatches)
              NoteLinkEntity(
                id: _uuid.v4(),
                userId: _currentUser.id,
                fromNoteId: finalNote.id,
                toNoteId: match.noteId,
                relationType: match.relationType,
                score: match.score,
                createdAt: DateTime.now(),
              ),
          ]);

      final completeSession = generatingSession.copyWith(
        phase: LearningSessionPhase.complete,
        noteId: finalNote.id,
        updatedAt: DateTime.now(),
      );
      await _learningRepository.upsertSession(completeSession);

      state = state.copyWith(
        activeSession: completeSession,
        isWorking: false,
        lastGeneratedNoteId: finalNote.id,
        statusMessage: 'Session complete. Your corrected note is saved for review.',
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

  String _promptForMode(LearningSessionMode mode) {
    return switch (mode) {
      LearningSessionMode.assisted =>
        'Explain what you just read in your own words. What are the key ideas and what would someone misunderstand?',
      LearningSessionMode.strict =>
        'Retell the section from memory with definitions, edge cases, names, examples, and precise distinctions.',
    };
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
