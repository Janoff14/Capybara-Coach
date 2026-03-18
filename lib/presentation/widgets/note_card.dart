import 'package:flutter/material.dart';

import '../../core/design_system/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/study_note.dart';
import 'status_chip.dart';

class NoteCard extends StatelessWidget {
  const NoteCard({
    super.key,
    required this.note,
    required this.folder,
    required this.onTap,
  });

  final StudyNote note;
  final FolderEntity? folder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppColors.ink.withValues(alpha: 0.05),
              blurRadius: 24,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusChip(status: note.aiProcessingStatus),
                if (folder != null)
                  Chip(
                    label: Text(folder!.title),
                    avatar: const Icon(Icons.folder_outlined, size: 16),
                  ),
                Text(
                  formatDateTime(note.updatedAt),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.ink.withValues(alpha: 0.55),
                      ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              note.cleanedTitle,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 10),
            Text(
              note.cleanedSummary,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tag in note.tags.take(4))
                  Chip(
                    label: Text('#$tag'),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
