enum NoteProcessingStatus {
  draft,
  uploading,
  transcribing,
  generating,
  organizing,
  ready,
  failed;

  String get label => switch (this) {
        NoteProcessingStatus.draft => 'Draft',
        NoteProcessingStatus.uploading => 'Uploading',
        NoteProcessingStatus.transcribing => 'Transcribing',
        NoteProcessingStatus.generating => 'Generating note',
        NoteProcessingStatus.organizing => 'Organizing',
        NoteProcessingStatus.ready => 'Ready',
        NoteProcessingStatus.failed => 'Failed',
      };
}

enum ProcessingJobStatus {
  pending,
  running,
  complete,
  failed;
}

enum ProcessingJobType {
  transcription,
  noteGeneration,
  relatedNotes;
}

class ProcessingJob {
  const ProcessingJob({
    required this.id,
    required this.userId,
    required this.noteId,
    required this.jobType,
    required this.status,
    required this.provider,
    required this.errorMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String noteId;
  final ProcessingJobType jobType;
  final ProcessingJobStatus status;
  final String provider;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime updatedAt;
}
