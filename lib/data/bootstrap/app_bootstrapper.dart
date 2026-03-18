import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../app/app_dependencies.dart';
import '../../core/config/app_environment.dart';
import '../../domain/models/app_user.dart';
import '../firebase/firebase_auth_service.dart';
import '../firebase/firebase_audio_storage_service.dart';
import '../firebase/firebase_initializer.dart';
import '../firebase/firebase_notes_repository.dart';
import '../local/recording_device_service.dart';
import '../mock/mock_audio_storage_service.dart';
import '../mock/mock_auth_service.dart';
import '../mock/mock_document_parsing_service.dart';
import '../mock/mock_knowledge_organization_service.dart';
import '../mock/mock_learning_repository.dart';
import '../mock/mock_notes_repository.dart';
import '../mock/mock_related_notes_service.dart';
import '../mock/mock_recall_evaluation_service.dart';
import '../mock/mock_session_note_synthesis_service.dart';
import '../mock/mock_study_note_generation_service.dart';
import '../mock/mock_transcription_service.dart';

class AppBootstrapper {
  const AppBootstrapper();

  Future<AppDependencies> create() async {
    final environment = AppEnvironment.fromEnvironment();
    final firebaseRuntime = await FirebaseInitializer.initialize(environment);

    final authService = firebaseRuntime.enabled
        ? FirebaseAppAuthService(firebaseAuth: FirebaseAuth.instance)
        : MockAuthService(
            seedUser: AppUser(
              id: environment.demoUserId,
              email: environment.demoUserEmail,
              displayName: environment.demoUserName,
              createdAt: DateTime.now().subtract(const Duration(days: 28)),
              planTier: PlanTier.free,
            ),
          );

    final currentUser = await authService.initializeSession();

    final notesRepository = firebaseRuntime.enabled
        ? FirebaseNotesRepository()
        : MockNotesRepository.seeded(currentUser);
    final learningRepository = MockLearningRepository.seeded(currentUser);

    return AppDependencies(
      environment: environment,
      firebaseRuntime: firebaseRuntime,
      currentUser: currentUser,
      authService: authService,
      learningRepository: learningRepository,
      notesRepository: notesRepository,
      recordingDeviceService: createRecordingDeviceService(),
      audioStorageService: firebaseRuntime.enabled
          ? FirebaseAudioStorageService(storage: FirebaseStorage.instance)
          : const MockAudioStorageService(),
      transcriptionService: const MockTranscriptionService(),
      documentParsingService: const MockDocumentParsingService(),
      recallEvaluationService: const MockRecallEvaluationService(),
      sessionNoteSynthesisService: const MockSessionNoteSynthesisService(),
      studyNoteGenerationService: const MockStudyNoteGenerationService(),
      knowledgeOrganizationService: const MockKnowledgeOrganizationService(),
      relatedNotesService: const MockRelatedNotesService(),
    );
  }
}
