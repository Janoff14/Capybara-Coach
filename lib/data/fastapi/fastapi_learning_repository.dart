import 'dart:async';

import 'package:collection/collection.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/services/learning_repository.dart';
import 'capybara_coach_api_client.dart';

class FastApiLearningRepository implements LearningRepository {
  FastApiLearningRepository({
    required AppUser currentUser,
    required CapybaraCoachApiClient apiClient,
    required Duration pollInterval,
  })  : _currentUser = currentUser,
        _apiClient = apiClient {
    Timer.periodic(pollInterval, (_) {
      unawaited(refreshAll());
    });
    unawaited(refreshAll());
  }

  final AppUser _currentUser;
  final CapybaraCoachApiClient _apiClient;
  final StreamController<void> _sourcesChanged =
      StreamController<void>.broadcast();
  final StreamController<void> _sessionsChanged =
      StreamController<void>.broadcast();

  final List<LearningSource> _sources = <LearningSource>[];
  final List<LearningSession> _sessions = <LearningSession>[];

  bool _refreshing = false;

  Future<void> refreshAll() async {
    if (_refreshing) {
      return;
    }

    _refreshing = true;
    try {
      final sources = await _apiClient.listLearningSources(user: _currentUser);
      _replaceSources(sources);

      final sessions = await _apiClient.listStudySessions(
        user: _currentUser,
        sources: sources,
      );
      _replaceSessions(sessions);
    } finally {
      _refreshing = false;
    }
  }

  Future<void> refreshSource(String sourceId) async {
    final source = await _apiClient.fetchLearningSource(
      user: _currentUser,
      sourceId: sourceId,
    );
    await upsertSource(source);
  }

  Future<void> refreshSession(String sessionId) async {
    final session = await _apiClient.fetchStudySession(
      user: _currentUser,
      sessionId: sessionId,
      sources: _sourcesFor(_currentUser.id),
    );
    await upsertSession(session);
  }

  @override
  Future<List<LearningSource>> listSources(String userId) async {
    if (userId == _currentUser.id) {
      await refreshAll();
    }
    return _sourcesFor(userId);
  }

  @override
  Future<List<LearningSession>> listSessions(String userId) async {
    if (userId == _currentUser.id) {
      await refreshAll();
    }
    return _sessionsFor(userId);
  }

  @override
  Future<void> upsertSource(LearningSource source) async {
    final index = _sources.indexWhere((item) => item.id == source.id);
    if (index == -1) {
      _sources.add(source);
    } else {
      _sources[index] = source;
    }
    _sources.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _sourcesChanged.add(null);
  }

  @override
  Future<void> upsertSession(LearningSession session) async {
    final index = _sessions.indexWhere((item) => item.id == session.id);
    if (index == -1) {
      _sessions.add(session);
    } else {
      _sessions[index] = session;
    }
    _sessions.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _sessionsChanged.add(null);
  }

  @override
  Stream<List<LearningSource>> watchSources(String userId) async* {
    if (userId == _currentUser.id) {
      unawaited(refreshAll());
    }
    yield _sourcesFor(userId);
    yield* _sourcesChanged.stream.map((_) => _sourcesFor(userId));
  }

  @override
  Stream<LearningSession?> watchSession(String userId, String sessionId) async* {
    if (userId == _currentUser.id) {
      unawaited(refreshSession(sessionId));
    }
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
    if (userId == _currentUser.id) {
      unawaited(refreshAll());
    }
    yield _sessionsFor(userId);
    yield* _sessionsChanged.stream.map((_) => _sessionsFor(userId));
  }

  List<LearningSource> _sourcesFor(String userId) {
    return _sources.where((source) => source.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  List<LearningSession> _sessionsFor(String userId) {
    return _sessions.where((session) => session.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  void _replaceSources(List<LearningSource> incoming) {
    for (final source in incoming) {
      final index = _sources.indexWhere((item) => item.id == source.id);
      if (index == -1) {
        _sources.add(source);
      } else {
        _sources[index] = source;
      }
    }

    _sources.removeWhere(
      (source) =>
          source.userId == _currentUser.id &&
          incoming.none((item) => item.id == source.id),
    );
    _sources.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _sourcesChanged.add(null);
  }

  void _replaceSessions(List<LearningSession> incoming) {
    for (final session in incoming) {
      final index = _sessions.indexWhere((item) => item.id == session.id);
      if (index == -1) {
        _sessions.add(session);
      } else {
        _sessions[index] = session;
      }
    }

    _sessions.removeWhere(
      (session) =>
          session.userId == _currentUser.id &&
          incoming.none((item) => item.id == session.id),
    );
    _sessions.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _sessionsChanged.add(null);
  }
}
