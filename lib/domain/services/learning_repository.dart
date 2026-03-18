import '../models/learning_session.dart';
import '../models/learning_source.dart';

abstract class LearningRepository {
  Stream<List<LearningSource>> watchSources(String userId);

  Future<List<LearningSource>> listSources(String userId);

  Future<void> upsertSource(LearningSource source);

  Stream<List<LearningSession>> watchSessions(String userId);

  Stream<LearningSession?> watchSession(String userId, String sessionId);

  Future<List<LearningSession>> listSessions(String userId);

  Future<void> upsertSession(LearningSession session);
}
