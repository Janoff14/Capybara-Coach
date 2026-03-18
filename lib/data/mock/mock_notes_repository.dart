import 'dart:async';

import 'package:collection/collection.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/note_link_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/notes_repository.dart';
import 'mock_seed_data.dart';

class MockNotesRepository implements NotesRepository {
  MockNotesRepository.seeded(AppUser user)
      : _folders = MockSeedData.folders(user),
        _notes = MockSeedData.notes(user),
        _links = [
          NoteLinkEntity(
            id: 'link-energy-cycle',
            userId: user.id,
            fromNoteId: 'note-photosynthesis',
            toNoteId: 'note-cellular-respiration',
            relationType: 'energy cycle',
            score: 0.91,
            createdAt: DateTime.now().subtract(const Duration(days: 1)),
          ),
        ];

  final List<FolderEntity> _folders;
  final List<StudyNote> _notes;
  final List<NoteLinkEntity> _links;
  final StreamController<void> _foldersChanged = StreamController<void>.broadcast();
  final StreamController<void> _notesChanged = StreamController<void>.broadcast();
  final StreamController<void> _linksChanged = StreamController<void>.broadcast();

  @override
  Future<List<FolderEntity>> listFolders(String userId) async => _foldersFor(userId);

  @override
  Future<List<StudyNote>> listNotes(String userId) async => _notesFor(userId);

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
    _foldersChanged.add(null);
  }

  @override
  Future<void> upsertNote(StudyNote note) async {
    final index = _notes.indexWhere((item) => item.id == note.id);
    if (index == -1) {
      _notes.add(note);
    } else {
      _notes[index] = note;
    }
    _notesChanged.add(null);
  }

  @override
  Future<void> upsertProcessingJob(ProcessingJob job) async {}

  @override
  Stream<List<FolderEntity>> watchFolders(String userId) async* {
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
    yield _noteById(userId, noteId);
    yield* _notesChanged.stream.map((_) => _noteById(userId, noteId));
  }

  @override
  Stream<List<StudyNote>> watchNotes(String userId) async* {
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
}
