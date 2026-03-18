import 'app_user.dart';
import 'folder_entity.dart';
import 'study_note.dart';

class StoredAudioAsset {
  const StoredAudioAsset({
    required this.downloadUrl,
    required this.storagePath,
    required this.providerKey,
  });

  final String downloadUrl;
  final String storagePath;
  final String providerKey;
}

class TranscriptResult {
  const TranscriptResult({
    required this.text,
    required this.languageCode,
    required this.providerKey,
  });

  final String text;
  final String languageCode;
  final String providerKey;
}

class GeneratedStudyNote {
  const GeneratedStudyNote({
    required this.title,
    required this.summary,
    required this.cleanedContent,
    required this.keyIdeas,
    required this.importantTerms,
    required this.reviewQuestions,
    required this.tags,
    required this.topics,
  });

  final String title;
  final String summary;
  final String cleanedContent;
  final List<String> keyIdeas;
  final List<String> importantTerms;
  final List<String> reviewQuestions;
  final List<String> tags;
  final List<String> topics;
}

class KnowledgeOrganizationPlan {
  const KnowledgeOrganizationPlan({
    required this.folderTitle,
    required this.folderDescription,
    required this.createNewFolder,
    required this.tags,
    required this.topics,
  });

  final String folderTitle;
  final String folderDescription;
  final bool createNewFolder;
  final List<String> tags;
  final List<String> topics;
}

class RelatedNoteMatch {
  const RelatedNoteMatch({
    required this.noteId,
    required this.relationType,
    required this.score,
  });

  final String noteId;
  final String relationType;
  final double score;
}

class NoteGenerationContext {
  const NoteGenerationContext({
    required this.user,
    required this.transcript,
  });

  final AppUser user;
  final TranscriptResult transcript;
}

class KnowledgeOrganizationContext {
  const KnowledgeOrganizationContext({
    required this.user,
    required this.generatedNote,
    required this.existingFolders,
    required this.existingNotes,
  });

  final AppUser user;
  final GeneratedStudyNote generatedNote;
  final List<FolderEntity> existingFolders;
  final List<StudyNote> existingNotes;
}

class RelatedNotesContext {
  const RelatedNotesContext({
    required this.currentNote,
    required this.existingNotes,
  });

  final StudyNote currentNote;
  final List<StudyNote> existingNotes;
}
