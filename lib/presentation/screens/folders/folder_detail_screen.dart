import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';
import '../../widgets/empty_state_card.dart';
import '../../widgets/note_card.dart';

class FolderDetailScreen extends ConsumerWidget {
  const FolderDetailScreen({super.key, required this.folderId});

  final String folderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final folder = ref.watch(folderByIdProvider(folderId));
    final notes = ref.watch(notesByFolderProvider(folderId));

    if (folder == null) {
      return const EmptyStateCard(
        title: 'Folder not found',
        message: 'The selected folder is missing or has not loaded yet.',
        icon: Icons.folder_off_outlined,
      );
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextButton.icon(
            onPressed: () => context.go('/library'),
            icon: const Icon(Icons.arrow_back),
            label: const Text('Back to review library'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            folder.title,
            style: Theme.of(
              context,
            ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Text(folder.description),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 10,
            children: [
              Chip(
                label: Text(
                  folder.aiGenerated
                      ? 'AI-generated folder'
                      : 'Manual starter folder',
                ),
              ),
              Chip(label: Text('${notes.length} notes')),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          if (notes.isEmpty)
            const EmptyStateCard(
              title: 'No notes inside yet',
              message:
                  'New captures will appear here when they match this folder.',
            )
          else
            for (final note in notes) ...[
              NoteCard(
                note: note,
                folder: folder,
                onTap: () => context.go('/notes/${note.id}'),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
        ],
      ),
    );
  }
}
