import 'dart:async';

import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/voice_note_pipeline_service.dart';
import 'capybara_coach_api_client.dart';

class FastApiVoiceNotePipelineService implements VoiceNotePipelineService {
  const FastApiVoiceNotePipelineService({
    required CapybaraCoachApiClient apiClient,
    required NotesRepository notesRepository,
    required Duration pollInterval,
    required Duration readyTimeout,
  })  : _apiClient = apiClient,
        _notesRepository = notesRepository,
        _pollInterval = pollInterval,
        _readyTimeout = readyTimeout;

  final CapybaraCoachApiClient _apiClient;
  final NotesRepository _notesRepository;
  final Duration _pollInterval;
  final Duration _readyTimeout;

  @override
  String get providerKey => 'fastapi';

  @override
  Future<StudyNote> processRecording({
    required AppUser user,
    required CapturedAudio recording,
    VoiceNoteProgressCallback? onProgress,
  }) async {
    final submitted = await _apiClient.uploadAudio(
      user: user,
      recording: recording,
    );

    final placeholder = StudyNote(
      id: submitted.noteId,
      userId: user.id,
      folderId: null,
      sourceAudioUrl: null,
      rawTranscript: '',
      cleanedTitle: 'Processing your recording',
      cleanedSummary: 'Uploading audio and starting transcription.',
      cleanedContent: 'Your structured note will appear as soon as the backend finishes.',
      keyIdeas: const <String>[],
      reviewQuestions: const <String>[],
      keyTerms: const <String>[],
      tags: const <String>[],
      topics: const <String>[],
      relatedNoteIds: const <String>[],
      aiProcessingStatus: submitted.status,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      sourceDuration: recording.duration,
    );

    await _notesRepository.upsertNote(placeholder);
    onProgress?.call(placeholder);

    final deadline = DateTime.now().add(_readyTimeout);
    while (true) {
      final note = await _apiClient.fetchNote(
        user: user,
        noteId: submitted.noteId,
      );
      final hydrated = note.copyWith(sourceDuration: recording.duration);
      await _notesRepository.upsertNote(hydrated);
      onProgress?.call(hydrated);

      if (hydrated.aiProcessingStatus == NoteProcessingStatus.ready) {
        return hydrated;
      }

      if (hydrated.aiProcessingStatus == NoteProcessingStatus.failed) {
        throw StateError(
          hydrated.cleanedSummary.isNotEmpty
              ? hydrated.cleanedSummary
              : 'Backend note processing failed.',
        );
      }

      if (DateTime.now().isAfter(deadline)) {
        throw TimeoutException(
          'Timed out while waiting for the note to finish processing.',
        );
      }

      await Future<void>.delayed(_pollInterval);
    }
  }
}
