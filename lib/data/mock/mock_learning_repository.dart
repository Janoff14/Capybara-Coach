import 'dart:async';

import 'package:collection/collection.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/services/learning_repository.dart';
import 'mock_learning_seed_data.dart';

class MockLearningRepository implements LearningRepository {
  MockLearningRepository.seeded(AppUser user)
      : _sources = MockLearningSeedData.sources(user),
        _sessions = [];

  final List<LearningSource> _sources;
  final List<LearningSession> _sessions;
  final StreamController<void> _sourcesChanged = StreamController<void>.broadcast();
  final StreamController<void> _sessionsChanged = StreamController<void>.broadcast();

  @override
  Future<List<LearningSession>> listSessions(String userId) async => _sessionsFor(userId);

  @override
  Future<List<LearningSource>> listSources(String userId) async => _sourcesFor(userId);

  @override
  Future<void> upsertSession(LearningSession session) async {
    final index = _sessions.indexWhere((item) => item.id == session.id);
    if (index == -1) {
      _sessions.add(session);
    } else {
      _sessions[index] = session;
    }
    _sessionsChanged.add(null);
  }

  @override
  Future<void> upsertSource(LearningSource source) async {
    final index = _sources.indexWhere((item) => item.id == source.id);
    if (index == -1) {
      _sources.add(source);
    } else {
      _sources[index] = source;
    }
    _sourcesChanged.add(null);
  }

  @override
  Stream<LearningSession?> watchSession(String userId, String sessionId) async* {
    yield _sessions.firstWhereOrNull(
      (session) => session.userId == userId && session.id == sessionId,
    );
    yield* _sessionsChanged.stream.map(
      (_) => _sessions.firstWhereOrNull(
        (session) => session.userId == userId && session.id == sessionId,
      ),
    );
  }

  @override
  Stream<List<LearningSession>> watchSessions(String userId) async* {
    yield _sessionsFor(userId);
    yield* _sessionsChanged.stream.map((_) => _sessionsFor(userId));
  }

  @override
  Stream<List<LearningSource>> watchSources(String userId) async* {
    yield _sourcesFor(userId);
    yield* _sourcesChanged.stream.map((_) => _sourcesFor(userId));
  }

  List<LearningSession> _sessionsFor(String userId) {
    return _sessions.where((session) => session.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  List<LearningSource> _sourcesFor(String userId) {
    return _sources.where((source) => source.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }
}
