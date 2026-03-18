import '../../domain/models/captured_audio.dart';
import '../../domain/models/recording_phase.dart';

class RecordingState {
  const RecordingState({
    required this.phase,
    required this.elapsed,
    required this.statusMessage,
    required this.recorderSupported,
    required this.pendingAudio,
    required this.lastSavedNoteId,
    required this.processingNoteId,
    required this.errorMessage,
  });

  factory RecordingState.initial({
    required bool recorderSupported,
  }) {
    return RecordingState(
      phase: recorderSupported ? RecordingPhase.idle : RecordingPhase.unsupported,
      elapsed: Duration.zero,
      statusMessage: recorderSupported
          ? 'Speak naturally and DictaCoach will turn it into a study note.'
          : 'Recording is reserved for the mobile app. Web stays focused on reading.',
      recorderSupported: recorderSupported,
      pendingAudio: null,
      lastSavedNoteId: null,
      processingNoteId: null,
      errorMessage: null,
    );
  }

  final RecordingPhase phase;
  final Duration elapsed;
  final String statusMessage;
  final bool recorderSupported;
  final CapturedAudio? pendingAudio;
  final String? lastSavedNoteId;
  final String? processingNoteId;
  final String? errorMessage;

  bool get isBusy {
    return phase == RecordingPhase.uploading ||
        phase == RecordingPhase.transcribing ||
        phase == RecordingPhase.generating ||
        phase == RecordingPhase.organizing ||
        phase == RecordingPhase.saving;
  }

  bool get isLiveCapture {
    return phase == RecordingPhase.recording || phase == RecordingPhase.paused;
  }

  RecordingState copyWith({
    RecordingPhase? phase,
    Duration? elapsed,
    String? statusMessage,
    bool? recorderSupported,
    CapturedAudio? pendingAudio,
    String? lastSavedNoteId,
    String? processingNoteId,
    String? errorMessage,
    bool clearPendingAudio = false,
    bool clearLastSavedNoteId = false,
    bool clearProcessingNoteId = false,
    bool clearErrorMessage = false,
  }) {
    return RecordingState(
      phase: phase ?? this.phase,
      elapsed: elapsed ?? this.elapsed,
      statusMessage: statusMessage ?? this.statusMessage,
      recorderSupported: recorderSupported ?? this.recorderSupported,
      pendingAudio: clearPendingAudio ? null : pendingAudio ?? this.pendingAudio,
      lastSavedNoteId: clearLastSavedNoteId
          ? null
          : lastSavedNoteId ?? this.lastSavedNoteId,
      processingNoteId: clearProcessingNoteId
          ? null
          : processingNoteId ?? this.processingNoteId,
      errorMessage: clearErrorMessage ? null : errorMessage ?? this.errorMessage,
    );
  }
}
