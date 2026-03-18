import '../models/folder_entity.dart';
import '../models/note_link_entity.dart';
import '../models/note_processing.dart';
import '../models/study_note.dart';

abstract class NotesRepository {
  Stream<List<FolderEntity>> watchFolders(String userId);

  Stream<List<StudyNote>> watchNotes(String userId);

  Stream<StudyNote?> watchNote(String userId, String noteId);

  Stream<List<NoteLinkEntity>> watchLinksFor(String userId, String noteId);

  Future<List<FolderEntity>> listFolders(String userId);

  Future<List<StudyNote>> listNotes(String userId);

  Future<void> upsertFolder(FolderEntity folder);

  Future<void> upsertNote(StudyNote note);

  Future<void> upsertProcessingJob(ProcessingJob job);

  Future<void> replaceLinksForNote(
    String userId,
    String noteId,
    List<NoteLinkEntity> links,
  );
}
