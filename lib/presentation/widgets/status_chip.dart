import 'package:flutter/material.dart';

import '../../core/design_system/app_theme.dart';
import '../../domain/models/note_processing.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.status,
  });

  final NoteProcessingStatus status;

  @override
  Widget build(BuildContext context) {
    final style = switch (status) {
      NoteProcessingStatus.ready => (AppColors.success, Icons.check_circle_outline),
      NoteProcessingStatus.failed => (AppColors.danger, Icons.error_outline),
      NoteProcessingStatus.uploading => (AppColors.ocean, Icons.cloud_upload_outlined),
      NoteProcessingStatus.transcribing => (AppColors.ocean, Icons.graphic_eq),
      NoteProcessingStatus.generating => (AppColors.warning, Icons.auto_awesome),
      NoteProcessingStatus.organizing => (AppColors.mint, Icons.account_tree_outlined),
      NoteProcessingStatus.draft => (AppColors.ink, Icons.edit_note_outlined),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: style.$1.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(style.$2, size: 14, color: style.$1),
          const SizedBox(width: 6),
          Text(
            status.label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: style.$1,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}
