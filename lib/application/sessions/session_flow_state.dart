import '../../domain/models/captured_audio.dart';
import '../../domain/models/learning_session.dart';

class SessionFlowState {
  const SessionFlowState({
    required this.activeSession,
    required this.readingElapsed,
    required this.recallElapsed,
    required this.pendingRecallAudio,
    required this.isImporting,
    required this.isWorking,
    required this.statusMessage,
    required this.lastGeneratedNoteId,
    required this.errorMessage,
  });

  const SessionFlowState.initial()
      : activeSession = null,
        readingElapsed = Duration.zero,
        recallElapsed = Duration.zero,
        pendingRecallAudio = null,
        isImporting = false,
        isWorking = false,
        statusMessage =
            'Upload a document, read a focused section, then prove you learned it.',
        lastGeneratedNoteId = null,
        errorMessage = null;

  final LearningSession? activeSession;
  final Duration readingElapsed;
  final Duration recallElapsed;
  final CapturedAudio? pendingRecallAudio;
  final bool isImporting;
  final bool isWorking;
  final String statusMessage;
  final String? lastGeneratedNoteId;
  final String? errorMessage;

  bool get hasActiveSession => activeSession != null;

  SessionFlowState copyWith({
    LearningSession? activeSession,
    Duration? readingElapsed,
    Duration? recallElapsed,
    CapturedAudio? pendingRecallAudio,
    bool? isImporting,
    bool? isWorking,
    String? statusMessage,
    String? lastGeneratedNoteId,
    String? errorMessage,
    bool clearActiveSession = false,
    bool clearPendingRecallAudio = false,
    bool clearLastGeneratedNoteId = false,
    bool clearErrorMessage = false,
  }) {
    return SessionFlowState(
      activeSession: clearActiveSession
          ? null
          : activeSession ?? this.activeSession,
      readingElapsed: readingElapsed ?? this.readingElapsed,
      recallElapsed: recallElapsed ?? this.recallElapsed,
      pendingRecallAudio: clearPendingRecallAudio
          ? null
          : pendingRecallAudio ?? this.pendingRecallAudio,
      isImporting: isImporting ?? this.isImporting,
      isWorking: isWorking ?? this.isWorking,
      statusMessage: statusMessage ?? this.statusMessage,
      lastGeneratedNoteId: clearLastGeneratedNoteId
          ? null
          : lastGeneratedNoteId ?? this.lastGeneratedNoteId,
      errorMessage: clearErrorMessage ? null : errorMessage ?? this.errorMessage,
    );
  }
}
