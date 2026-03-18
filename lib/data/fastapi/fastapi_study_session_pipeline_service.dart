import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/services/notes_repository.dart';
import '../../domain/services/study_session_pipeline_service.dart';
import 'capybara_coach_api_client.dart';

class FastApiStudySessionPipelineService implements StudySessionPipelineService {
  const FastApiStudySessionPipelineService({
    required CapybaraCoachApiClient apiClient,
    required NotesRepository notesRepository,
  })  : _apiClient = apiClient,
        _notesRepository = notesRepository;

  final CapybaraCoachApiClient _apiClient;
  final NotesRepository _notesRepository;

  @override
  String get providerKey => 'fastapi-study-session';

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
    return _apiClient.importDocument(
      user: user,
      sourceType: sourceType,
      title: title,
      subtitle: subtitle,
      rawText: rawText,
      fileBytes: fileBytes,
      fileName: fileName,
    );
  }

  @override
  Future<LearningSession> createSession({
    required AppUser user,
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  }) {
    return _apiClient.createStudySession(
      user: user,
      source: source,
      section: section,
      mode: mode,
    );
  }

  @override
  Future<LearningSession> evaluateRecallAudio({
    required AppUser user,
    required LearningSession session,
    required CapturedAudio recording,
    required Duration actualReadDuration,
  }) {
    return _apiClient.evaluateStudySessionAudio(
      user: user,
      session: session,
      recording: recording,
      actualReadDuration: actualReadDuration,
    );
  }

  @override
  Future<StudySessionGenerationResult> generateNote({
    required AppUser user,
    required LearningSession session,
  }) async {
    final generated = await _apiClient.generateStudySessionNote(
      user: user,
      session: session,
    );
    await _notesRepository.upsertNote(generated.note);
    return StudySessionGenerationResult(
      session: generated.session,
      note: generated.note,
    );
  }
}
