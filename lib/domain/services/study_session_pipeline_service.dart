import '../models/app_user.dart';
import '../models/captured_audio.dart';
import '../models/learning_session.dart';
import '../models/learning_source.dart';
import '../models/study_note.dart';

class StudySessionGenerationResult {
  const StudySessionGenerationResult({
    required this.session,
    required this.note,
  });

  final LearningSession session;
  final StudyNote note;
}

abstract class StudySessionPipelineService {
  String get providerKey;

  Future<LearningSource> importDocument({
    required AppUser user,
    required LearningSourceType sourceType,
    required String title,
    required String subtitle,
    String? rawText,
    List<int>? fileBytes,
    String? fileName,
  });

  Future<LearningSession> createSession({
    required AppUser user,
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  });

  Future<LearningSession> evaluateRecallAudio({
    required AppUser user,
    required LearningSession session,
    required CapturedAudio recording,
    required Duration actualReadDuration,
  });

  Future<StudySessionGenerationResult> generateNote({
    required AppUser user,
    required LearningSession session,
  });
}
