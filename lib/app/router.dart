import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../presentation/screens/capture/capture_screen.dart';
import '../presentation/screens/dashboard/dashboard_screen.dart';
import '../presentation/screens/folders/folder_detail_screen.dart';
import '../presentation/screens/library/library_screen.dart';
import '../presentation/screens/notes/note_detail_screen.dart';
import '../presentation/screens/session/session_screen.dart';
import '../presentation/screens/settings/settings_screen.dart';
import '../presentation/shell/app_shell.dart';

GoRouter buildRouter(Ref ref) {
  final initialLocation = kIsWeb ? '/library' : '/capture';

  return GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(path: '/', redirect: (context, state) => initialLocation),
      ShellRoute(
        builder: (context, state, child) {
          return AppShell(location: state.matchedLocation, child: child);
        },
        routes: [
          GoRoute(
            path: '/capture',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: CaptureScreen()),
          ),
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: DashboardScreen()),
          ),
          GoRoute(
            path: '/session',
            pageBuilder: (context, state) => NoTransitionPage<void>(
              child: SessionScreen(
                sourceId: state.uri.queryParameters['sourceId'],
              ),
            ),
          ),
          GoRoute(
            path: '/library',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: LibraryScreen()),
          ),
          GoRoute(
            path: '/folders/:folderId',
            builder: (context, state) {
              final folderId = state.pathParameters['folderId']!;
              return FolderDetailScreen(folderId: folderId);
            },
          ),
          GoRoute(
            path: '/notes/:noteId',
            builder: (context, state) {
              final noteId = state.pathParameters['noteId']!;
              return NoteDetailScreen(noteId: noteId);
            },
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: SettingsScreen()),
          ),
        ],
      ),
    ],
  );
}
