import 'dart:async';

import 'package:collection/collection.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/assistant_mood.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/recording_phase.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/pipeline_services.dart';
import '../assistant/assistant_controller.dart';
import 'recording_state.dart';

class RecordingController extends StateNotifier<RecordingState> {
  RecordingController({
    required AppUser currentUser,
    required NotesRepository notesRepository,
    required RecordingDeviceService recordingDeviceService,
    required AudioStorageService audioStorageService,
    required TranscriptionService transcriptionService,
    required StudyNoteGenerationService studyNoteGenerationService,
    required KnowledgeOrganizationService knowledgeOrganizationService,
    required RelatedNotesService relatedNotesService,
    required AssistantController assistantController,
  })  : _currentUser = currentUser,
        _notesRepository = notesRepository,
        _recordingDeviceService = recordingDeviceService,
        _audioStorageService = audioStorageService,
        _transcriptionService = transcriptionService,
        _studyNoteGenerationService = studyNoteGenerationService,
        _knowledgeOrganizationService = knowledgeOrganizationService,
        _relatedNotesService = relatedNotesService,
        _assistantController = assistantController,
        super(RecordingState.initial(
          recorderSupported: recordingDeviceService.isSupported,
        ));

  final _uuid = const Uuid();
  final AppUser _currentUser;
  final NotesRepository _notesRepository;
  final RecordingDeviceService _recordingDeviceService;
  final AudioStorageService _audioStorageService;
  final TranscriptionService _transcriptionService;
  final StudyNoteGenerationService _studyNoteGenerationService;
  final KnowledgeOrganizationService _knowledgeOrganizationService;
  final RelatedNotesService _relatedNotesService;
  final AssistantController _assistantController;

  Timer? _ticker;
  DateTime? _startedAt;
  Duration _elapsedBeforePause = Duration.zero;

  Future<void> startRecording() async {
    if (!_recordingDeviceService.isSupported || state.isBusy) {
      return;
    }

    try {
      final sessionId = _uuid.v4();
      await _recordingDeviceService.start(sessionId: sessionId);

      _elapsedBeforePause = Duration.zero;
      _startedAt = DateTime.now();
      _startTicker();
      _assistantController.setMood(AssistantMood.listening);

      state = state.copyWith(
        phase: RecordingPhase.recording,
        elapsed: Duration.zero,
        statusMessage: 'Listening... pause when you need a beat, then stop to review.',
        clearPendingAudio: true,
        clearErrorMessage: true,
      );
    } catch (error) {
      _setError(
        'Microphone access failed. Check permissions and try again.',
        error,
      );
    }
  }

  Future<void> pauseRecording() async {
    if (state.phase != RecordingPhase.recording) {
      return;
    }

    try {
      await _recordingDeviceService.pause();
      _elapsedBeforePause = state.elapsed;
      _startedAt = null;
      _stopTicker();
      _assistantController.setMood(AssistantMood.idle);

      state = state.copyWith(
        phase: RecordingPhase.paused,
        statusMessage: 'Paused. Resume when you are ready, or stop to prepare the note.',
      );
    } catch (error) {
      _setError('Could not pause the recording.', error);
    }
  }

  Future<void> resumeRecording() async {
    if (state.phase != RecordingPhase.paused) {
      return;
    }

    try {
      await _recordingDeviceService.resume();
      _startedAt = DateTime.now();
      _startTicker();
      _assistantController.setMood(AssistantMood.listening);

      state = state.copyWith(
        phase: RecordingPhase.recording,
        statusMessage: 'Listening again... keep going until the idea is complete.',
      );
    } catch (error) {
      _setError('Could not resume the recording.', error);
    }
  }

  Future<void> stopRecording() async {
    if (state.phase != RecordingPhase.recording &&
        state.phase != RecordingPhase.paused) {
      return;
    }

    try {
      _stopTicker();
      final capturedAudio = await _recordingDeviceService.stop(
        duration: state.elapsed,
      );
      _startedAt = null;
      _elapsedBeforePause = Duration.zero;
      _assistantController.setMood(AssistantMood.idle);

      state = state.copyWith(
        phase: RecordingPhase.review,
        pendingAudio: capturedAudio,
        statusMessage: 'Clip ready. Save it to run transcription and note-building.',
      );
    } catch (error) {
      _setError('Could not finalize the recording.', error);
    }
  }

  Future<void> discardRecording() async {
    if (state.phase == RecordingPhase.recording ||
        state.phase == RecordingPhase.paused) {
      await _recordingDeviceService.cancel();
    }

    _stopTicker();
    _startedAt = null;
    _elapsedBeforePause = Duration.zero;
    _assistantController.setMood(AssistantMood.idle);

    state = RecordingState.initial(
      recorderSupported: _recordingDeviceService.isSupported,
    ).copyWith(
      lastSavedNoteId: state.lastSavedNoteId,
    );
  }

  Future<void> saveRecording() async {
    final pendingAudio = state.pendingAudio;

    if (pendingAudio == null || state.phase != RecordingPhase.review) {
      return;
    }

    final noteId = _uuid.v4();
    final now = DateTime.now();
    final jobBaseId = _uuid.v4();

    try {
      _assistantController.setMood(AssistantMood.thinking);
      state = state.copyWith(
        phase: RecordingPhase.uploading,
        statusMessage: 'Uploading audio for transcription...',
        processingNoteId: noteId,
        clearErrorMessage: true,
      );

      final storedAudio = await _audioStorageService.upload(
        user: _currentUser,
        recording: pendingAudio,
      );

      var placeholderNote = StudyNote(
        id: noteId,
        userId: _currentUser.id,
        folderId: null,
        sourceAudioUrl: storedAudio.downloadUrl,
        rawTranscript: '',
        cleanedTitle: 'Processing your latest voice note',
        cleanedSummary: 'DictaCoach is shaping your recording into a study note.',
        cleanedContent:
            'The transcript and note structure will appear here when processing finishes.',
        keyIdeas: const <String>[],
        reviewQuestions: const <String>[],
        keyTerms: const <String>[],
        tags: const <String>[],
        topics: const <String>[],
        relatedNoteIds: const <String>[],
        aiProcessingStatus: NoteProcessingStatus.uploading,
        createdAt: now,
        updatedAt: now,
        sourceDuration: pendingAudio.duration,
      );

      await _notesRepository.upsertNote(placeholderNote);
      await _notesRepository.upsertProcessingJob(
        ProcessingJob(
          id: '$jobBaseId-upload',
          userId: _currentUser.id,
          noteId: noteId,
          jobType: ProcessingJobType.transcription,
          status: ProcessingJobStatus.running,
          provider: _audioStorageService.providerKey,
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        ),
      );

      state = state.copyWith(
        phase: RecordingPhase.transcribing,
        statusMessage: 'Transcribing the recording...',
      );

      final transcript = await _transcriptionService.transcribe(
        user: _currentUser,
        audio: storedAudio,
        duration: pendingAudio.duration,
      );

      placeholderNote = placeholderNote.copyWith(
        rawTranscript: transcript.text,
        aiProcessingStatus: NoteProcessingStatus.transcribing,
        updatedAt: DateTime.now(),
      );
      await _notesRepository.upsertNote(placeholderNote);

      state = state.copyWith(
        phase: RecordingPhase.generating,
        statusMessage: 'Turning the raw transcript into a clean study note...',
      );

      final generatedNote = await _studyNoteGenerationService.generate(
        context: NoteGenerationContext(
          user: _currentUser,
          transcript: transcript,
        ),
      );

      final folders = await _notesRepository.listFolders(_currentUser.id);
      final notes = await _notesRepository.listNotes(_currentUser.id);

      state = state.copyWith(
        phase: RecordingPhase.organizing,
        statusMessage: 'Assigning folders, tags, and related note links...',
      );

      final organizationPlan = await _knowledgeOrganizationService.organize(
        context: KnowledgeOrganizationContext(
          user: _currentUser,
          generatedNote: generatedNote,
          existingFolders: folders,
          existingNotes: notes,
        ),
      );

      FolderEntity? targetFolder = folders.firstWhereOrNull(
        (folder) =>
            folder.title.toLowerCase() ==
            organizationPlan.folderTitle.toLowerCase(),
      );

      if (targetFolder == null && organizationPlan.createNewFolder) {
        targetFolder = FolderEntity(
          id: _uuid.v4(),
          userId: _currentUser.id,
          title: organizationPlan.folderTitle,
          description: organizationPlan.folderDescription,
          parentFolderId: null,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
          aiGenerated: true,
        );
        await _notesRepository.upsertFolder(targetFolder);
      }

      final mergedTags = {
        ...generatedNote.tags,
        ...organizationPlan.tags,
      }.toList()
        ..sort();
      final mergedTopics = {
        ...generatedNote.topics,
        ...organizationPlan.topics,
      }.toList()
        ..sort();

      var finalNote = placeholderNote.copyWith(
        folderId: targetFolder?.id ?? folders.firstOrNull?.id,
        cleanedTitle: generatedNote.title,
        cleanedSummary: generatedNote.summary,
        cleanedContent: generatedNote.cleanedContent,
        keyIdeas: generatedNote.keyIdeas,
        reviewQuestions: generatedNote.reviewQuestions,
        keyTerms: generatedNote.importantTerms,
        tags: mergedTags,
        topics: mergedTopics,
        aiProcessingStatus: NoteProcessingStatus.generating,
        updatedAt: DateTime.now(),
      );

      final relatedMatches = await _relatedNotesService.findRelated(
        context: RelatedNotesContext(
          currentNote: finalNote,
          existingNotes: notes.where((note) => note.id != finalNote.id).toList(),
        ),
      );

      finalNote = finalNote.copyWith(
        relatedNoteIds: relatedMatches.map((match) => match.noteId).toList(),
        aiProcessingStatus: NoteProcessingStatus.ready,
        updatedAt: DateTime.now(),
      );

      await _notesRepository.upsertNote(finalNote);

      final links = relatedMatches
          .map(
            (match) => NoteLinkEntity(
              id: _uuid.v4(),
              userId: _currentUser.id,
              fromNoteId: finalNote.id,
              toNoteId: match.noteId,
              relationType: match.relationType,
              score: match.score,
              createdAt: DateTime.now(),
            ),
          )
          .toList();
      await _notesRepository.replaceLinksForNote(
        _currentUser.id,
        finalNote.id,
        links,
      );

      await _backfillRelatedNoteIds(finalNote, relatedMatches, notes);

      final completedAt = DateTime.now();
      await _notesRepository.upsertProcessingJob(
        ProcessingJob(
          id: '$jobBaseId-generate',
          userId: _currentUser.id,
          noteId: noteId,
          jobType: ProcessingJobType.noteGeneration,
          status: ProcessingJobStatus.complete,
          provider: [
            _transcriptionService.providerKey,
            _studyNoteGenerationService.providerKey,
            _knowledgeOrganizationService.providerKey,
            _relatedNotesService.providerKey,
          ].join(' -> '),
          errorMessage: null,
          createdAt: now,
          updatedAt: completedAt,
        ),
      );

      state = state.copyWith(
        phase: RecordingPhase.saved,
        elapsed: Duration.zero,
        statusMessage: 'Saved. Your note is organized and linked for later review.',
        lastSavedNoteId: finalNote.id,
        clearPendingAudio: true,
        clearProcessingNoteId: true,
      );

      await _assistantController.celebrateSave();
    } catch (error) {
      final failedAt = DateTime.now();
      await _notesRepository.upsertProcessingJob(
        ProcessingJob(
          id: '$jobBaseId-failed',
          userId: _currentUser.id,
          noteId: noteId,
          jobType: ProcessingJobType.noteGeneration,
          status: ProcessingJobStatus.failed,
          provider: _studyNoteGenerationService.providerKey,
          errorMessage: error.toString(),
          createdAt: now,
          updatedAt: failedAt,
        ),
      );

      await _notesRepository.upsertNote(
        StudyNote(
          id: noteId,
          userId: _currentUser.id,
          folderId: null,
          sourceAudioUrl: null,
          rawTranscript: '',
          cleanedTitle: 'Processing failed',
          cleanedSummary: 'This note needs a retry.',
          cleanedContent:
              'Something interrupted the pipeline. Retry the recording or inspect the backend configuration.',
          keyIdeas: const <String>[],
          reviewQuestions: const <String>[],
          keyTerms: const <String>[],
          tags: const <String>[],
          topics: const <String>[],
          relatedNoteIds: const <String>[],
          aiProcessingStatus: NoteProcessingStatus.failed,
          createdAt: now,
          updatedAt: failedAt,
          sourceDuration: pendingAudio.duration,
        ),
      );

      _setError('Note processing failed. Try again or inspect provider setup.', error);
    }
  }

  Future<void> _backfillRelatedNoteIds(
    StudyNote currentNote,
    List<RelatedNoteMatch> relatedMatches,
    List<StudyNote> existingNotes,
  ) async {
    for (final match in relatedMatches) {
      final relatedNote = existingNotes.firstWhereOrNull(
        (note) => note.id == match.noteId,
      );

      if (relatedNote == null || relatedNote.relatedNoteIds.contains(currentNote.id)) {
        continue;
      }

      await _notesRepository.upsertNote(
        relatedNote.copyWith(
          relatedNoteIds: [...relatedNote.relatedNoteIds, currentNote.id],
        ),
      );
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final startedAt = _startedAt;
      if (startedAt == null) {
        return;
      }

      final elapsed = _elapsedBeforePause + DateTime.now().difference(startedAt);
      state = state.copyWith(elapsed: elapsed);
    });
  }

  void _stopTicker() {
    _ticker?.cancel();
    _ticker = null;
  }

  void _setError(String message, Object error) {
    _stopTicker();
    _startedAt = null;
    _elapsedBeforePause = Duration.zero;
    _assistantController.signalError();
    state = state.copyWith(
      phase: RecordingPhase.error,
      statusMessage: message,
      errorMessage: error.toString(),
    );
  }

  @override
  void dispose() {
    _stopTicker();
    super.dispose();
  }
}
