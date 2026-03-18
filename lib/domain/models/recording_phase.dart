enum RecordingPhase {
  unsupported,
  idle,
  recording,
  paused,
  review,
  uploading,
  transcribing,
  generating,
  organizing,
  saving,
  saved,
  error;

  String get label => switch (this) {
        RecordingPhase.unsupported => 'Read-only',
        RecordingPhase.idle => 'Ready to record',
        RecordingPhase.recording => 'Recording',
        RecordingPhase.paused => 'Paused',
        RecordingPhase.review => 'Review clip',
        RecordingPhase.uploading => 'Uploading audio',
        RecordingPhase.transcribing => 'Transcribing voice',
        RecordingPhase.generating => 'Building study note',
        RecordingPhase.organizing => 'Linking knowledge',
        RecordingPhase.saving => 'Saving note',
        RecordingPhase.saved => 'Saved',
        RecordingPhase.error => 'Needs attention',
      };
}
