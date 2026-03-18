import 'learning_source.dart';

enum LearningSessionMode {
  assisted,
  strict;

  String get label => switch (this) {
        LearningSessionMode.assisted => 'Assisted',
        LearningSessionMode.strict => 'Strict',
      };
}

enum LearningSessionPhase {
  idle,
  reading,
  readyToRecall,
  recordingRecall,
  reviewRecording,
  transcribing,
  evaluating,
  feedbackReady,
  generatingNote,
  complete,
  error;

  String get label => switch (this) {
        LearningSessionPhase.idle => 'Idle',
        LearningSessionPhase.reading => 'Read',
        LearningSessionPhase.readyToRecall => 'Recall',
        LearningSessionPhase.recordingRecall => 'Retell',
        LearningSessionPhase.reviewRecording => 'Review attempt',
        LearningSessionPhase.transcribing => 'Speech to text',
        LearningSessionPhase.evaluating => 'AI evaluation',
        LearningSessionPhase.feedbackReady => 'Feedback',
        LearningSessionPhase.generatingNote => 'Create note',
        LearningSessionPhase.complete => 'Review',
        LearningSessionPhase.error => 'Error',
      };
}

class SessionScoreBreakdown {
  const SessionScoreBreakdown({
    required this.totalScore,
    required this.recallScore,
    required this.accuracyScore,
    required this.detailScore,
    required this.missingConceptCount,
    required this.misconceptionCount,
  });

  final int totalScore;
  final int recallScore;
  final int accuracyScore;
  final int detailScore;
  final int missingConceptCount;
  final int misconceptionCount;
}

class SessionFeedback {
  const SessionFeedback({
    required this.breakdown,
    required this.strengths,
    required this.specificFeedback,
    required this.missingPieces,
    required this.misconceptions,
    required this.thresholdScore,
  });

  final SessionScoreBreakdown breakdown;
  final List<String> strengths;
  final List<String> specificFeedback;
  final List<String> missingPieces;
  final List<String> misconceptions;
  final int thresholdScore;

  bool get canPass => breakdown.totalScore >= thresholdScore;
}

class LearningSession {
  const LearningSession({
    required this.id,
    required this.userId,
    required this.sourceId,
    required this.sourceTitle,
    required this.sourceType,
    required this.sectionId,
    required this.sectionTitle,
    required this.mode,
    required this.phase,
    required this.sourceText,
    required this.targetReadDuration,
    required this.actualReadDuration,
    required this.attemptCount,
    required this.recallPrompt,
    required this.recallTranscript,
    required this.feedback,
    required this.noteId,
    required this.createdAt,
    required this.updatedAt,
    required this.errorMessage,
  });

  final String id;
  final String userId;
  final String sourceId;
  final String sourceTitle;
  final LearningSourceType sourceType;
  final String sectionId;
  final String sectionTitle;
  final LearningSessionMode mode;
  final LearningSessionPhase phase;
  final String sourceText;
  final Duration targetReadDuration;
  final Duration actualReadDuration;
  final int attemptCount;
  final String recallPrompt;
  final String? recallTranscript;
  final SessionFeedback? feedback;
  final String? noteId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? errorMessage;

  LearningSession copyWith({
    String? id,
    String? userId,
    String? sourceId,
    String? sourceTitle,
    LearningSourceType? sourceType,
    String? sectionId,
    String? sectionTitle,
    LearningSessionMode? mode,
    LearningSessionPhase? phase,
    String? sourceText,
    Duration? targetReadDuration,
    Duration? actualReadDuration,
    int? attemptCount,
    String? recallPrompt,
    String? recallTranscript,
    SessionFeedback? feedback,
    String? noteId,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? errorMessage,
    bool clearRecallTranscript = false,
    bool clearFeedback = false,
    bool clearNoteId = false,
    bool clearErrorMessage = false,
  }) {
    return LearningSession(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      sourceId: sourceId ?? this.sourceId,
      sourceTitle: sourceTitle ?? this.sourceTitle,
      sourceType: sourceType ?? this.sourceType,
      sectionId: sectionId ?? this.sectionId,
      sectionTitle: sectionTitle ?? this.sectionTitle,
      mode: mode ?? this.mode,
      phase: phase ?? this.phase,
      sourceText: sourceText ?? this.sourceText,
      targetReadDuration: targetReadDuration ?? this.targetReadDuration,
      actualReadDuration: actualReadDuration ?? this.actualReadDuration,
      attemptCount: attemptCount ?? this.attemptCount,
      recallPrompt: recallPrompt ?? this.recallPrompt,
      recallTranscript: clearRecallTranscript
          ? null
          : recallTranscript ?? this.recallTranscript,
      feedback: clearFeedback ? null : feedback ?? this.feedback,
      noteId: clearNoteId ? null : noteId ?? this.noteId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      errorMessage: clearErrorMessage ? null : errorMessage ?? this.errorMessage,
    );
  }
}
