import 'package:collection/collection.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:go_router/go_router.dart';

import '../application/assistant/assistant_controller.dart';
import '../application/recording/recording_controller.dart';
import '../application/recording/recording_state.dart';
import '../application/sessions/session_flow_controller.dart';
import '../application/sessions/session_flow_state.dart';
import '../core/config/app_environment.dart';
import '../data/firebase/firebase_initializer.dart';
import '../domain/models/assistant_mood.dart';
import '../domain/models/app_user.dart';
import '../domain/models/folder_entity.dart';
import '../domain/models/learning_session.dart';
import '../domain/models/learning_source.dart';
import '../domain/models/study_note.dart';
import '../domain/services/auth_service.dart';
import '../domain/services/learning_repository.dart';
import '../domain/services/notes_repository.dart';
import '../domain/services/pipeline_services.dart';
import '../domain/services/voice_note_pipeline_service.dart';
import 'app_dependencies.dart';
import 'router.dart';

final appDependenciesProvider = Provider<AppDependencies>((ref) {
  throw UnimplementedError('AppDependencies must be overridden at bootstrap.');
});

final environmentProvider = Provider<AppEnvironment>(
  (ref) => ref.watch(appDependenciesProvider).environment,
);

final firebaseRuntimeProvider = Provider<FirebaseRuntime>(
  (ref) => ref.watch(appDependenciesProvider).firebaseRuntime,
);

final currentUserProvider = Provider<AppUser>(
  (ref) => ref.watch(appDependenciesProvider).currentUser,
);

final authServiceProvider = Provider<AuthService>(
  (ref) => ref.watch(appDependenciesProvider).authService,
);

final learningRepositoryProvider = Provider<LearningRepository>(
  (ref) => ref.watch(appDependenciesProvider).learningRepository,
);

final notesRepositoryProvider = Provider<NotesRepository>(
  (ref) => ref.watch(appDependenciesProvider).notesRepository,
);

final recordingDeviceServiceProvider = Provider<RecordingDeviceService>(
  (ref) => ref.watch(appDependenciesProvider).recordingDeviceService,
);

final audioStorageServiceProvider = Provider<AudioStorageService>(
  (ref) => ref.watch(appDependenciesProvider).audioStorageService,
);

final transcriptionServiceProvider = Provider<TranscriptionService>(
  (ref) => ref.watch(appDependenciesProvider).transcriptionService,
);

final documentParsingServiceProvider = Provider<DocumentParsingService>(
  (ref) => ref.watch(appDependenciesProvider).documentParsingService,
);

final recallEvaluationServiceProvider = Provider<RecallEvaluationService>(
  (ref) => ref.watch(appDependenciesProvider).recallEvaluationService,
);

final sessionNoteSynthesisServiceProvider =
    Provider<SessionNoteSynthesisService>(
      (ref) => ref.watch(appDependenciesProvider).sessionNoteSynthesisService,
    );

final studyNoteGenerationServiceProvider = Provider<StudyNoteGenerationService>(
  (ref) => ref.watch(appDependenciesProvider).studyNoteGenerationService,
);

final knowledgeOrganizationServiceProvider =
    Provider<KnowledgeOrganizationService>(
      (ref) => ref.watch(appDependenciesProvider).knowledgeOrganizationService,
    );

final relatedNotesServiceProvider = Provider<RelatedNotesService>(
  (ref) => ref.watch(appDependenciesProvider).relatedNotesService,
);

final voiceNotePipelineServiceProvider = Provider<VoiceNotePipelineService>(
  (ref) => ref.watch(appDependenciesProvider).voiceNotePipelineService,
);

final assistantControllerProvider =
    StateNotifierProvider<AssistantController, AssistantMood>((ref) {
      return AssistantController();
    });

final recordingControllerProvider =
    StateNotifierProvider<RecordingController, RecordingState>((ref) {
      return RecordingController(
        currentUser: ref.watch(currentUserProvider),
        recordingDeviceService: ref.watch(recordingDeviceServiceProvider),
        voiceNotePipelineService: ref.watch(voiceNotePipelineServiceProvider),
        assistantController: ref.read(assistantControllerProvider.notifier),
      );
    });

final sessionFlowControllerProvider =
    StateNotifierProvider<SessionFlowController, SessionFlowState>((ref) {
      return SessionFlowController(
        currentUser: ref.watch(currentUserProvider),
        learningRepository: ref.watch(learningRepositoryProvider),
        notesRepository: ref.watch(notesRepositoryProvider),
        recordingDeviceService: ref.watch(recordingDeviceServiceProvider),
        audioStorageService: ref.watch(audioStorageServiceProvider),
        transcriptionService: ref.watch(transcriptionServiceProvider),
        documentParsingService: ref.watch(documentParsingServiceProvider),
        recallEvaluationService: ref.watch(recallEvaluationServiceProvider),
        sessionNoteSynthesisService: ref.watch(
          sessionNoteSynthesisServiceProvider,
        ),
        knowledgeOrganizationService: ref.watch(
          knowledgeOrganizationServiceProvider,
        ),
        relatedNotesService: ref.watch(relatedNotesServiceProvider),
      );
    });

final routerProvider = Provider<GoRouter>((ref) => buildRouter(ref));

final sourcesProvider = StreamProvider<List<LearningSource>>((ref) {
  final repository = ref.watch(learningRepositoryProvider);
  final currentUser = ref.watch(currentUserProvider);
  return repository.watchSources(currentUser.id);
});

final sessionsProvider = StreamProvider<List<LearningSession>>((ref) {
  final repository = ref.watch(learningRepositoryProvider);
  final currentUser = ref.watch(currentUserProvider);
  return repository.watchSessions(currentUser.id);
});

final notesProvider = StreamProvider<List<StudyNote>>((ref) {
  final repository = ref.watch(notesRepositoryProvider);
  final currentUser = ref.watch(currentUserProvider);
  return repository.watchNotes(currentUser.id);
});

final foldersProvider = StreamProvider<List<FolderEntity>>((ref) {
  final repository = ref.watch(notesRepositoryProvider);
  final currentUser = ref.watch(currentUserProvider);
  return repository.watchFolders(currentUser.id);
});

final noteProvider = StreamProvider.family<StudyNote?, String>((ref, noteId) {
  final repository = ref.watch(notesRepositoryProvider);
  final currentUser = ref.watch(currentUserProvider);
  return repository.watchNote(currentUser.id, noteId);
});

final sourceByIdProvider = Provider.family<LearningSource?, String>((
  ref,
  sourceId,
) {
  final sources =
      ref.watch(sourcesProvider).asData?.value ?? const <LearningSource>[];
  return sources.firstWhereOrNull((source) => source.id == sourceId);
});

final sourceSectionProvider =
    Provider.family<LearningSection?, ({String sourceId, String sectionId})>((
      ref,
      request,
    ) {
      final source = ref.watch(sourceByIdProvider(request.sourceId));
      return source?.sections.firstWhereOrNull(
        (section) => section.id == request.sectionId,
      );
    });

final activeSessionProvider = Provider<LearningSession?>((ref) {
  return ref.watch(sessionFlowControllerProvider).activeSession;
});

final continueLearningSessionProvider = Provider<LearningSession?>((ref) {
  final active = ref.watch(activeSessionProvider);
  if (active != null) {
    return active;
  }

  final sessions =
      ref.watch(sessionsProvider).asData?.value ?? const <LearningSession>[];
  return sessions.firstWhereOrNull(
    (session) => session.phase != LearningSessionPhase.complete,
  );
});

final dashboardProgressProvider =
    Provider<({int sessionsToday, int streak, int lowScoreCount})>((ref) {
      final sessions =
          ref.watch(sessionsProvider).asData?.value ??
          const <LearningSession>[];
      final now = DateTime.now();
      final sessionsToday = sessions
          .where(
            (session) =>
                session.updatedAt.year == now.year &&
                session.updatedAt.month == now.month &&
                session.updatedAt.day == now.day &&
                session.phase == LearningSessionPhase.complete,
          )
          .length;

      final sessionDays =
          sessions
              .where(
                (session) => session.phase == LearningSessionPhase.complete,
              )
              .map(
                (session) => DateTime(
                  session.updatedAt.year,
                  session.updatedAt.month,
                  session.updatedAt.day,
                ),
              )
              .toSet()
              .toList()
            ..sort((a, b) => b.compareTo(a));

      var streak = 0;
      for (var i = 0; i < sessionDays.length; i++) {
        final expected = DateTime(
          now.year,
          now.month,
          now.day,
        ).subtract(Duration(days: i));
        if (sessionDays.contains(expected)) {
          streak++;
        } else {
          break;
        }
      }

      final lowScoreCount = sessions
          .where(
            (session) => session.feedback != null && !session.feedback!.canPass,
          )
          .length;

      return (
        sessionsToday: sessionsToday,
        streak: streak,
        lowScoreCount: lowScoreCount,
      );
    });

final weakConceptsProvider = Provider<List<String>>((ref) {
  final sessions =
      ref.watch(sessionsProvider).asData?.value ?? const <LearningSession>[];
  final counts = <String, int>{};

  for (final session in sessions) {
    final feedback = session.feedback;
    if (feedback == null) {
      continue;
    }

    for (final item in feedback.missingPieces) {
      counts.update(item, (value) => value + 1, ifAbsent: () => 1);
    }
  }

  final ranked = counts.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  return ranked.take(4).map((entry) => entry.key).toList();
});

final activeTopicsProvider = Provider<List<LearningSource>>((ref) {
  final sources =
      ref.watch(sourcesProvider).asData?.value ?? const <LearningSource>[];
  return sources.take(4).toList();
});

final libraryQueryProvider = StateProvider<String>((ref) => '');

final filteredNotesProvider = Provider<List<StudyNote>>((ref) {
  final notes = ref.watch(notesProvider).asData?.value ?? const <StudyNote>[];
  final query = ref.watch(libraryQueryProvider).trim().toLowerCase();

  if (query.isEmpty) {
    return notes;
  }

  return notes.where((note) {
    final haystack = [
      note.cleanedTitle,
      note.cleanedSummary,
      note.cleanedContent,
      note.rawTranscript,
      ...note.tags,
      ...note.topics,
      ...note.keyTerms,
    ].join(' ').toLowerCase();

    return haystack.contains(query);
  }).toList();
});

final latestNoteProvider = Provider<StudyNote?>((ref) {
  final notes = ref.watch(notesProvider).asData?.value ?? const <StudyNote>[];

  if (notes.isEmpty) {
    return null;
  }

  final sortedNotes = [...notes]
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return sortedNotes.first;
});

final folderByIdProvider = Provider.family<FolderEntity?, String>((ref, id) {
  final folders =
      ref.watch(foldersProvider).asData?.value ?? const <FolderEntity>[];
  return folders.firstWhereOrNull((folder) => folder.id == id);
});

final notesByFolderProvider = Provider.family<List<StudyNote>, String>((
  ref,
  folderId,
) {
  final notes = ref.watch(notesProvider).asData?.value ?? const <StudyNote>[];
  return notes.where((note) => note.folderId == folderId).toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
});

final relatedNotesProvider = Provider.family<List<StudyNote>, String>((
  ref,
  noteId,
) {
  final notes = ref.watch(notesProvider).asData?.value ?? const <StudyNote>[];
  final note = notes.firstWhereOrNull((item) => item.id == noteId);

  if (note == null || note.relatedNoteIds.isEmpty) {
    return const <StudyNote>[];
  }

  final relatedIds = note.relatedNoteIds.toSet();
  return notes.where((item) => relatedIds.contains(item.id)).toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
});

List<Override> createDependencyOverrides(AppDependencies dependencies) {
  return [appDependenciesProvider.overrideWithValue(dependencies)];
}
