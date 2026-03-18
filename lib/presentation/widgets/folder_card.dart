import 'package:flutter/material.dart';

import '../../core/design_system/app_theme.dart';
import '../../domain/models/folder_entity.dart';

class FolderCard extends StatelessWidget {
  const FolderCard({
    super.key,
    required this.folder,
    required this.noteCount,
    required this.onTap,
  });

  final FolderEntity folder;
  final int noteCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(26),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(26),
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
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: (folder.aiGenerated ? AppColors.mint : AppColors.ocean)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                folder.aiGenerated
                    ? Icons.auto_awesome_mosaic_outlined
                    : Icons.folder_copy_outlined,
                color: folder.aiGenerated ? AppColors.mint : AppColors.ocean,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              folder.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              folder.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              '$noteCount notes',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.ink.withValues(alpha: 0.62),
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
