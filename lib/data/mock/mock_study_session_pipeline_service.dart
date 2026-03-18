import 'package:collection/collection.dart';
import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/pipeline_services.dart';
import '../../domain/services/study_session_pipeline_service.dart';

class MockStudySessionPipelineService implements StudySessionPipelineService {
  MockStudySessionPipelineService({
    required NotesRepository notesRepository,
    required AudioStorageService audioStorageService,
    required TranscriptionService transcriptionService,
    required DocumentParsingService documentParsingService,
    required RecallEvaluationService recallEvaluationService,
    required SessionNoteSynthesisService sessionNoteSynthesisService,
    required KnowledgeOrganizationService knowledgeOrganizationService,
    required RelatedNotesService relatedNotesService,
  })  : _notesRepository = notesRepository,
        _audioStorageService = audioStorageService,
        _transcriptionService = transcriptionService,
        _documentParsingService = documentParsingService,
        _recallEvaluationService = recallEvaluationService,
        _sessionNoteSynthesisService = sessionNoteSynthesisService,
        _knowledgeOrganizationService = knowledgeOrganizationService,
        _relatedNotesService = relatedNotesService;

  final _uuid = const Uuid();
  final NotesRepository _notesRepository;
  final AudioStorageService _audioStorageService;
  final TranscriptionService _transcriptionService;
  final DocumentParsingService _documentParsingService;
  final RecallEvaluationService _recallEvaluationService;
  final SessionNoteSynthesisService _sessionNoteSynthesisService;
  final KnowledgeOrganizationService _knowledgeOrganizationService;
  final RelatedNotesService _relatedNotesService;

  @override
  String get providerKey => 'mock-study-session';

  @override
  Future<LearningSource> importDocument({
    required AppUser user,
    required LearningSourceType sourceType,
    required String title,
    required String subtitle,
    String? rawText,
    List<int>? fileBytes,
    String? fileName,
  }) {
    return _documentParsingService.importSource(
      user: user,
      sourceType: sourceType,
      title: title,
      subtitle: subtitle,
      rawText: rawText,
      fileName: fileName,
    );
  }

  @override
  Future<LearningSession> createSession({
    required AppUser user,
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  }) async {
    return LearningSession(
      id: _uuid.v4(),
      userId: user.id,
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
  }

  @override
  Future<LearningSession> evaluateRecallAudio({
    required AppUser user,
    required LearningSession session,
    required CapturedAudio recording,
    required Duration actualReadDuration,
  }) async {
    final stored = await _audioStorageService.upload(
      user: user,
      recording: recording,
    );
    final transcript = await _transcriptionService.transcribe(
      user: user,
      audio: stored,
      duration: recording.duration,
    );
    final feedback = await _recallEvaluationService.evaluate(
      session: session,
      recallTranscript: transcript.text,
    );

    return session.copyWith(
      phase: LearningSessionPhase.feedbackReady,
      actualReadDuration: actualReadDuration,
      attemptCount: session.attemptCount + 1,
      recallTranscript: transcript.text,
      feedback: feedback,
      updatedAt: DateTime.now(),
      clearErrorMessage: true,
    );
  }

  @override
  Future<StudySessionGenerationResult> generateNote({
    required AppUser user,
    required LearningSession session,
  }) async {
    final feedback = session.feedback;
    if (feedback == null || !feedback.canPass) {
      throw StateError('This session has not passed the recall gate yet.');
    }

    final generated = await _sessionNoteSynthesisService.synthesize(
      session: session,
      feedback: feedback,
    );
    final folders = await _notesRepository.listFolders(user.id);
    final existingNotes = await _notesRepository.listNotes(user.id);

    final organizationPlan = await _knowledgeOrganizationService.organize(
      context: KnowledgeOrganizationContext(
        user: user,
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
        userId: user.id,
        title: organizationPlan.folderTitle,
        description: organizationPlan.folderDescription,
        parentFolderId: null,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        aiGenerated: true,
      );
      await _notesRepository.upsertFolder(folder);
    }

    final provisionalNote = StudyNote(
      id: _uuid.v4(),
      userId: user.id,
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
      relatedNoteIds: const <String>[],
      aiProcessingStatus: NoteProcessingStatus.ready,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      sourceDuration: session.actualReadDuration,
    );

    final relatedMatches = await _relatedNotesService.findRelated(
      context: RelatedNotesContext(
        currentNote: provisionalNote,
        existingNotes: existingNotes,
      ),
    );

    final finalNote = provisionalNote.copyWith(
      relatedNoteIds: relatedMatches.map((match) => match.noteId).toList(),
    );
    await _notesRepository.upsertNote(finalNote);
    await _notesRepository.replaceLinksForNote(user.id, finalNote.id, [
      for (final match in relatedMatches)
        NoteLinkEntity(
          id: _uuid.v4(),
          userId: user.id,
          fromNoteId: finalNote.id,
          toNoteId: match.noteId,
          relationType: match.relationType,
          score: match.score,
          createdAt: DateTime.now(),
        ),
    ]);

    return StudySessionGenerationResult(
      session: session.copyWith(
        phase: LearningSessionPhase.complete,
        noteId: finalNote.id,
        updatedAt: DateTime.now(),
        clearErrorMessage: true,
      ),
      note: finalNote,
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
}
