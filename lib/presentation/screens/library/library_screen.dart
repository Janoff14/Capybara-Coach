import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';
import '../../../domain/models/folder_entity.dart';
import '../../../domain/models/study_note.dart';
import '../../widgets/empty_state_card.dart';
import '../../widgets/folder_card.dart';
import '../../widgets/note_card.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final folders =
        ref.watch(foldersProvider).asData?.value ?? const <FolderEntity>[];
    final notes = ref.watch(filteredNotesProvider);
    final allNotes =
        ref.watch(notesProvider).asData?.value ?? const <StudyNote>[];
    final isWide = MediaQuery.sizeOf(context).width >= 1100;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review library',
            style: Theme.of(
              context,
            ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Text(
            kIsWeb
                ? 'Browse folders, open earned notes, and review linked material. Session creation stays on mobile.'
                : 'Review the notes you earned after passing recall, and search by terms, tags, or topics.',
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            onChanged: (value) =>
                ref.read(libraryQueryProvider.notifier).state = value,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search review notes, terms, tags, and transcript text',
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (isWide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 4,
                  child: _FolderColumn(folders: folders, allNotes: allNotes),
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  flex: 7,
                  child: _NoteColumn(notes: notes, folders: folders),
                ),
              ],
            )
          else ...[
            _FolderColumn(folders: folders, allNotes: allNotes),
            const SizedBox(height: AppSpacing.lg),
            _NoteColumn(notes: notes, folders: folders),
          ],
        ],
      ),
    );
  }
}

class _FolderColumn extends StatelessWidget {
  const _FolderColumn({required this.folders, required this.allNotes});

  final List<FolderEntity> folders;
  final List<StudyNote> allNotes;

  @override
  Widget build(BuildContext context) {
    if (folders.isEmpty) {
      return const EmptyStateCard(
        title: 'No folders yet',
        message:
            'Passed sessions will create notes here and group them into review folders.',
        icon: Icons.folder_open_outlined,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Folders',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontSize: 26,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final folder in folders) ...[
          FolderCard(
            folder: folder,
            noteCount: allNotes
                .where((note) => note.folderId == folder.id)
                .length,
            onTap: () => context.go('/folders/${folder.id}'),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _NoteColumn extends StatelessWidget {
  const _NoteColumn({required this.notes, required this.folders});

  final List<StudyNote> notes;
  final List<FolderEntity> folders;

  @override
  Widget build(BuildContext context) {
    if (notes.isEmpty) {
      return const EmptyStateCard(
        title: 'No notes match that search',
        message:
            'Try a broader query or finish a session to generate a new review note.',
        icon: Icons.manage_search_outlined,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Notes',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontSize: 26,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final note in notes) ...[
          NoteCard(
            note: note,
            folder: folders.cast<FolderEntity?>().firstWhere(
              (folder) => folder?.id == note.folderId,
              orElse: () => null,
            ),
            onTap: () => context.go('/notes/${note.id}'),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}
