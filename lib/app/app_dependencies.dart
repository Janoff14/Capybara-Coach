import '../core/config/app_environment.dart';
import '../data/firebase/firebase_initializer.dart';
import '../domain/models/app_user.dart';
import '../domain/services/auth_service.dart';
import '../domain/services/learning_repository.dart';
import '../domain/services/notes_repository.dart';
import '../domain/services/pipeline_services.dart';
import '../domain/services/voice_note_pipeline_service.dart';

class AppDependencies {
  const AppDependencies({
    required this.environment,
    required this.firebaseRuntime,
    required this.currentUser,
    required this.authService,
    required this.learningRepository,
    required this.notesRepository,
    required this.recordingDeviceService,
    required this.audioStorageService,
    required this.transcriptionService,
    required this.documentParsingService,
    required this.recallEvaluationService,
    required this.sessionNoteSynthesisService,
    required this.studyNoteGenerationService,
    required this.knowledgeOrganizationService,
    required this.relatedNotesService,
    required this.voiceNotePipelineService,
  });

  final AppEnvironment environment;
  final FirebaseRuntime firebaseRuntime;
  final AppUser currentUser;
  final AuthService authService;
  final LearningRepository learningRepository;
  final NotesRepository notesRepository;
  final RecordingDeviceService recordingDeviceService;
  final AudioStorageService audioStorageService;
  final TranscriptionService transcriptionService;
  final DocumentParsingService documentParsingService;
  final RecallEvaluationService recallEvaluationService;
  final SessionNoteSynthesisService sessionNoteSynthesisService;
  final StudyNoteGenerationService studyNoteGenerationService;
  final KnowledgeOrganizationService knowledgeOrganizationService;
  final RelatedNotesService relatedNotesService;
  final VoiceNotePipelineService voiceNotePipelineService;
}
