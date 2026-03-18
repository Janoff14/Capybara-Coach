import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final environment = ref.watch(environmentProvider);
    final runtime = ref.watch(firebaseRuntimeProvider);
    final user = ref.watch(currentUserProvider);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Runtime and provider setup',
            style: Theme.of(
              context,
            ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Text(
            'This MVP defaults to safe local mocks, but the provider boundaries are already shaped for document parsing, speech-to-text, evaluation, corrected notes, and future usage limits.',
          ),
          const SizedBox(height: AppSpacing.lg),
          _InfoCard(
            title: 'Session',
            rows: [
              _InfoRow('User', user.displayName),
              _InfoRow('Plan', user.planTier.label),
              _InfoRow('Environment', environment.appFlavor),
              _InfoRow('Pipeline mode', environment.pipelineMode),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoCard(
            title: 'Providers',
            rows: [
              _InfoRow('Firebase runtime', runtime.label),
              _InfoRow('Firebase reason', runtime.reason),
              _InfoRow('Transcription', environment.transcriptionProvider),
              _InfoRow('Evaluator / notes', environment.llmProvider),
              _InfoRow('Embeddings', environment.embeddingsProvider),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoCard(
            title: 'Release prep',
            rows: [
              _InfoRow(
                'Android application ID',
                environment.androidApplicationId,
              ),
              _InfoRow('iOS bundle ID', environment.iosBundleId),
              _InfoRow('Functions region', environment.functionsRegion),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.rows});

  final String title;
  final List<_InfoRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          for (final row in rows) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 160,
                  child: Text(
                    row.label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                Expanded(child: Text(row.value)),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _InfoRow {
  const _InfoRow(this.label, this.value);

  final String label;
  final String value;
}
