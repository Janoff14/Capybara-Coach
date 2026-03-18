import '../models/app_user.dart';
import '../models/captured_audio.dart';
import '../models/learning_session.dart';
import '../models/learning_source.dart';
import '../models/note_generation.dart';

abstract class RecordingDeviceService {
  bool get isSupported;

  Future<void> start({required String sessionId});

  Future<void> pause();

  Future<void> resume();

  Future<CapturedAudio> stop({required Duration duration});

  Future<void> cancel();
}

abstract class AudioStorageService {
  String get providerKey;

  Future<StoredAudioAsset> upload({
    required AppUser user,
    required CapturedAudio recording,
  });
}

abstract class TranscriptionService {
  String get providerKey;

  Future<TranscriptResult> transcribe({
    required AppUser user,
    required StoredAudioAsset audio,
    required Duration duration,
  });
}

abstract class StudyNoteGenerationService {
  String get providerKey;

  Future<GeneratedStudyNote> generate({
    required NoteGenerationContext context,
  });
}

abstract class KnowledgeOrganizationService {
  String get providerKey;

  Future<KnowledgeOrganizationPlan> organize({
    required KnowledgeOrganizationContext context,
  });
}

abstract class RelatedNotesService {
  String get providerKey;

  Future<List<RelatedNoteMatch>> findRelated({
    required RelatedNotesContext context,
  });
}

abstract class DocumentParsingService {
  String get providerKey;

  Future<LearningSource> importSource({
    required AppUser user,
    required LearningSourceType sourceType,
    required String title,
    required String subtitle,
    String? rawText,
    String? fileName,
  });
}

abstract class RecallEvaluationService {
  String get providerKey;

  Future<SessionFeedback> evaluate({
    required LearningSession session,
    required String recallTranscript,
  });
}

abstract class SessionNoteSynthesisService {
  String get providerKey;

  Future<GeneratedStudyNote> synthesize({
    required LearningSession session,
    required SessionFeedback feedback,
  });
}
