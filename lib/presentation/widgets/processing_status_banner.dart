import 'package:flutter/material.dart';

import '../../core/design_system/app_theme.dart';
import '../../domain/models/recording_phase.dart';

class ProcessingStatusBanner extends StatelessWidget {
  const ProcessingStatusBanner({
    super.key,
    required this.phase,
    required this.message,
    this.errorMessage,
  });

  final RecordingPhase phase;
  final String message;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final style = switch (phase) {
      RecordingPhase.saved => (AppColors.success, Icons.check_circle_outline),
      RecordingPhase.error => (AppColors.danger, Icons.error_outline),
      RecordingPhase.recording => (AppColors.coral, Icons.mic),
      RecordingPhase.paused => (AppColors.warning, Icons.pause_circle_outline),
      _ => (AppColors.ocean, Icons.auto_awesome),
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: style.$1.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: style.$1.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(style.$2, color: style.$1),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  phase.label,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(message),
                if (errorMessage != null && errorMessage!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorMessage!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.ink.withValues(alpha: 0.62),
                        ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
