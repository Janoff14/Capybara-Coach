import 'package:collection/collection.dart';
import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/pipeline_services.dart';
import '../../domain/services/voice_note_pipeline_service.dart';

class MockVoiceNotePipelineService implements VoiceNotePipelineService {
  MockVoiceNotePipelineService({
    required NotesRepository notesRepository,
    required AudioStorageService audioStorageService,
    required TranscriptionService transcriptionService,
    required StudyNoteGenerationService studyNoteGenerationService,
    required KnowledgeOrganizationService knowledgeOrganizationService,
    required RelatedNotesService relatedNotesService,
  })  : _notesRepository = notesRepository,
        _audioStorageService = audioStorageService,
        _transcriptionService = transcriptionService,
        _studyNoteGenerationService = studyNoteGenerationService,
        _knowledgeOrganizationService = knowledgeOrganizationService,
        _relatedNotesService = relatedNotesService;

  final _uuid = const Uuid();
  final NotesRepository _notesRepository;
  final AudioStorageService _audioStorageService;
  final TranscriptionService _transcriptionService;
  final StudyNoteGenerationService _studyNoteGenerationService;
  final KnowledgeOrganizationService _knowledgeOrganizationService;
  final RelatedNotesService _relatedNotesService;

  @override
  String get providerKey => 'mock-pipeline';

  @override
  Future<StudyNote> processRecording({
    required AppUser user,
    required CapturedAudio recording,
    VoiceNoteProgressCallback? onProgress,
  }) async {
    final noteId = _uuid.v4();
    final now = DateTime.now();
    final jobBaseId = _uuid.v4();

    final storedAudio = await _audioStorageService.upload(
      user: user,
      recording: recording,
    );

    var placeholderNote = StudyNote(
      id: noteId,
      userId: user.id,
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
      sourceDuration: recording.duration,
    );

    await _notesRepository.upsertNote(placeholderNote);
    await _notesRepository.upsertProcessingJob(
      ProcessingJob(
        id: '$jobBaseId-upload',
        userId: user.id,
        noteId: noteId,
        jobType: ProcessingJobType.transcription,
        status: ProcessingJobStatus.running,
        provider: _audioStorageService.providerKey,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      ),
    );
    onProgress?.call(placeholderNote);

    final transcript = await _transcriptionService.transcribe(
      user: user,
      audio: storedAudio,
      duration: recording.duration,
    );

    placeholderNote = placeholderNote.copyWith(
      rawTranscript: transcript.text,
      aiProcessingStatus: NoteProcessingStatus.transcribing,
      updatedAt: DateTime.now(),
    );
    await _notesRepository.upsertNote(placeholderNote);
    onProgress?.call(placeholderNote);

    final generatedNote = await _studyNoteGenerationService.generate(
      context: NoteGenerationContext(
        user: user,
        transcript: transcript,
      ),
    );

    final folders = await _notesRepository.listFolders(user.id);
    final notes = await _notesRepository.listNotes(user.id);

    placeholderNote = placeholderNote.copyWith(
      aiProcessingStatus: NoteProcessingStatus.generating,
      updatedAt: DateTime.now(),
    );
    await _notesRepository.upsertNote(placeholderNote);
    onProgress?.call(placeholderNote);

    final organizationPlan = await _knowledgeOrganizationService.organize(
      context: KnowledgeOrganizationContext(
        user: user,
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
        userId: user.id,
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
      aiProcessingStatus: NoteProcessingStatus.organizing,
      updatedAt: DateTime.now(),
    );
    await _notesRepository.upsertNote(finalNote);
    onProgress?.call(finalNote);

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
            userId: user.id,
            fromNoteId: finalNote.id,
            toNoteId: match.noteId,
            relationType: match.relationType,
            score: match.score,
            createdAt: DateTime.now(),
          ),
        )
        .toList();

    await _notesRepository.replaceLinksForNote(
      user.id,
      finalNote.id,
      links,
    );
    await _backfillRelatedNoteIds(finalNote, relatedMatches, notes);

    await _notesRepository.upsertProcessingJob(
      ProcessingJob(
        id: '$jobBaseId-generate',
        userId: user.id,
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
        updatedAt: DateTime.now(),
      ),
    );

    onProgress?.call(finalNote);
    return finalNote;
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
}
