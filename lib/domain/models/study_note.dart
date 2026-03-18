import 'note_processing.dart';

class StudyNote {
  const StudyNote({
    required this.id,
    required this.userId,
    required this.folderId,
    required this.sourceAudioUrl,
    required this.rawTranscript,
    required this.cleanedTitle,
    required this.cleanedSummary,
    required this.cleanedContent,
    required this.keyIdeas,
    required this.reviewQuestions,
    required this.keyTerms,
    required this.tags,
    required this.topics,
    required this.relatedNoteIds,
    required this.aiProcessingStatus,
    required this.createdAt,
    required this.updatedAt,
    required this.sourceDuration,
  });

  final String id;
  final String userId;
  final String? folderId;
  final String? sourceAudioUrl;
  final String rawTranscript;
  final String cleanedTitle;
  final String cleanedSummary;
  final String cleanedContent;
  final List<String> keyIdeas;
  final List<String> reviewQuestions;
  final List<String> keyTerms;
  final List<String> tags;
  final List<String> topics;
  final List<String> relatedNoteIds;
  final NoteProcessingStatus aiProcessingStatus;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Duration sourceDuration;

  StudyNote copyWith({
    String? id,
    String? userId,
    String? folderId,
    String? sourceAudioUrl,
    String? rawTranscript,
    String? cleanedTitle,
    String? cleanedSummary,
    String? cleanedContent,
    List<String>? keyIdeas,
    List<String>? reviewQuestions,
    List<String>? keyTerms,
    List<String>? tags,
    List<String>? topics,
    List<String>? relatedNoteIds,
    NoteProcessingStatus? aiProcessingStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
    Duration? sourceDuration,
    bool clearFolderId = false,
    bool clearSourceAudioUrl = false,
  }) {
    return StudyNote(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      folderId: clearFolderId ? null : folderId ?? this.folderId,
      sourceAudioUrl: clearSourceAudioUrl
          ? null
          : sourceAudioUrl ?? this.sourceAudioUrl,
      rawTranscript: rawTranscript ?? this.rawTranscript,
      cleanedTitle: cleanedTitle ?? this.cleanedTitle,
      cleanedSummary: cleanedSummary ?? this.cleanedSummary,
      cleanedContent: cleanedContent ?? this.cleanedContent,
      keyIdeas: keyIdeas ?? this.keyIdeas,
      reviewQuestions: reviewQuestions ?? this.reviewQuestions,
      keyTerms: keyTerms ?? this.keyTerms,
      tags: tags ?? this.tags,
      topics: topics ?? this.topics,
      relatedNoteIds: relatedNoteIds ?? this.relatedNoteIds,
      aiProcessingStatus: aiProcessingStatus ?? this.aiProcessingStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      sourceDuration: sourceDuration ?? this.sourceDuration,
    );
  }
}
