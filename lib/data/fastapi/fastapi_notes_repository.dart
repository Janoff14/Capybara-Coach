import 'dart:async';

import 'package:collection/collection.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import 'capybara_coach_api_client.dart';

class FastApiNotesRepository implements NotesRepository {
  FastApiNotesRepository({
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
  final StreamController<void> _foldersChanged = StreamController<void>.broadcast();
  final StreamController<void> _notesChanged = StreamController<void>.broadcast();
  final StreamController<void> _linksChanged = StreamController<void>.broadcast();

  final List<FolderEntity> _folders = <FolderEntity>[];
  final List<StudyNote> _notes = <StudyNote>[];
  final List<NoteLinkEntity> _links = <NoteLinkEntity>[];

  bool _refreshing = false;

  Future<void> refreshAll() async {
    if (_refreshing) {
      return;
    }

    _refreshing = true;
    try {
      final folders = await _apiClient.listFolders(user: _currentUser);
      final notes = await _apiClient.listNotes(user: _currentUser);

      _replaceFolders(folders);
      _replaceNotes(notes);
    } finally {
      _refreshing = false;
    }
  }

  Future<void> refreshNote(String noteId) async {
    final note = await _apiClient.fetchNote(
      user: _currentUser,
      noteId: noteId,
    );
    await upsertNote(note);
  }

  @override
  Future<List<FolderEntity>> listFolders(String userId) async {
    if (userId == _currentUser.id) {
      await refreshAll();
    }
    return _foldersFor(userId);
  }

  @override
  Future<List<StudyNote>> listNotes(String userId) async {
    if (userId == _currentUser.id) {
      await refreshAll();
    }
    return _notesFor(userId);
  }

  @override
  Future<void> replaceLinksForNote(
    String userId,
    String noteId,
    List<NoteLinkEntity> links,
  ) async {
    _links.removeWhere(
      (link) => link.userId == userId && link.fromNoteId == noteId,
    );
    _links.addAll(links);
    _linksChanged.add(null);
  }

  @override
  Future<void> upsertFolder(FolderEntity folder) async {
    final index = _folders.indexWhere((item) => item.id == folder.id);
    if (index == -1) {
      _folders.add(folder);
    } else {
      _folders[index] = folder;
    }
    _folders.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _foldersChanged.add(null);
  }

  @override
  Future<void> upsertNote(StudyNote note) async {
    final index = _notes.indexWhere((item) => item.id == note.id);
    final merged = _mergeNote(_notes.elementAtOrNull(index), note);

    if (index == -1) {
      _notes.add(merged);
    } else {
      _notes[index] = merged;
    }

    _notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _notesChanged.add(null);
  }

  @override
  Future<void> upsertProcessingJob(ProcessingJob job) async {}

  @override
  Stream<List<FolderEntity>> watchFolders(String userId) async* {
    if (userId == _currentUser.id) {
      unawaited(refreshAll());
    }
    yield _foldersFor(userId);
    yield* _foldersChanged.stream.map((_) => _foldersFor(userId));
  }

  @override
  Stream<List<NoteLinkEntity>> watchLinksFor(String userId, String noteId) async* {
    yield _linksFor(userId, noteId);
    yield* _linksChanged.stream.map((_) => _linksFor(userId, noteId));
  }

  @override
  Stream<StudyNote?> watchNote(String userId, String noteId) async* {
    if (userId == _currentUser.id) {
      unawaited(refreshNote(noteId));
    }
    yield _noteById(userId, noteId);
    yield* _notesChanged.stream.map((_) => _noteById(userId, noteId));
  }

  @override
  Stream<List<StudyNote>> watchNotes(String userId) async* {
    if (userId == _currentUser.id) {
      unawaited(refreshAll());
    }
    yield _notesFor(userId);
    yield* _notesChanged.stream.map((_) => _notesFor(userId));
  }

  List<FolderEntity> _foldersFor(String userId) {
    return _folders.where((folder) => folder.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  List<NoteLinkEntity> _linksFor(String userId, String noteId) {
    return _links
        .where(
          (link) => link.userId == userId && link.fromNoteId == noteId,
        )
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
  }

  StudyNote? _noteById(String userId, String noteId) {
    return _notes.firstWhereOrNull(
      (note) => note.userId == userId && note.id == noteId,
    );
  }

  List<StudyNote> _notesFor(String userId) {
    return _notes.where((note) => note.userId == userId).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  void _replaceFolders(List<FolderEntity> incoming) {
    for (final folder in incoming) {
      final index = _folders.indexWhere((item) => item.id == folder.id);
      if (index == -1) {
        _folders.add(folder);
      } else {
        _folders[index] = folder;
      }
    }

    _folders.removeWhere(
      (folder) =>
          folder.userId == _currentUser.id &&
          incoming.none((item) => item.id == folder.id),
    );
    _folders.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _foldersChanged.add(null);
  }

  void _replaceNotes(List<StudyNote> incoming) {
    for (final note in incoming) {
      final index = _notes.indexWhere((item) => item.id == note.id);
      final merged = _mergeNote(_notes.elementAtOrNull(index), note);

      if (index == -1) {
        _notes.add(merged);
      } else {
        _notes[index] = merged;
      }
    }

    _notes.removeWhere(
      (note) =>
          note.userId == _currentUser.id &&
          incoming.none((item) => item.id == note.id),
    );
    _notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _notesChanged.add(null);
  }

  StudyNote _mergeNote(StudyNote? existing, StudyNote incoming) {
    if (existing == null) {
      return incoming;
    }

    return incoming.copyWith(
      sourceAudioUrl: incoming.sourceAudioUrl ?? existing.sourceAudioUrl,
      rawTranscript: incoming.rawTranscript.isNotEmpty
          ? incoming.rawTranscript
          : existing.rawTranscript,
      cleanedContent: incoming.cleanedContent.isNotEmpty
          ? incoming.cleanedContent
          : existing.cleanedContent,
      cleanedSummary: incoming.cleanedSummary.isNotEmpty
          ? incoming.cleanedSummary
          : existing.cleanedSummary,
      keyIdeas: incoming.keyIdeas.isNotEmpty ? incoming.keyIdeas : existing.keyIdeas,
      reviewQuestions: incoming.reviewQuestions.isNotEmpty
          ? incoming.reviewQuestions
          : existing.reviewQuestions,
      keyTerms: incoming.keyTerms.isNotEmpty ? incoming.keyTerms : existing.keyTerms,
      tags: incoming.tags.isNotEmpty ? incoming.tags : existing.tags,
      topics: incoming.topics.isNotEmpty ? incoming.topics : existing.topics,
      relatedNoteIds: incoming.relatedNoteIds.isNotEmpty
          ? incoming.relatedNoteIds
          : existing.relatedNoteIds,
      sourceDuration: incoming.sourceDuration != Duration.zero
          ? incoming.sourceDuration
          : existing.sourceDuration,
      folderId: incoming.folderId ?? existing.folderId,
      createdAt: existing.createdAt,
    );
  }
}
