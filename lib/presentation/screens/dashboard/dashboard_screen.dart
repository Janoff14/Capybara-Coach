import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../domain/models/learning_session.dart';
import '../../../domain/models/learning_source.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final continueSession = ref.watch(continueLearningSessionProvider);
    final progress = ref.watch(dashboardProgressProvider);
    final activeTopics = ref.watch(activeTopicsProvider);
    final weakConcepts = ref.watch(weakConceptsProvider);
    final latestNote = ref.watch(latestNoteProvider);
    final allSources =
        ref.watch(sourcesProvider).asData?.value ?? const <LearningSource>[];
    final isWide = MediaQuery.sizeOf(context).width >= 980;

    final continueLabel = switch (continueSession?.phase) {
      LearningSessionPhase.reading => 'Continue reading',
      LearningSessionPhase.readyToRecall ||
      LearningSessionPhase.recordingRecall ||
      LearningSessionPhase.reviewRecording ||
      LearningSessionPhase.transcribing ||
      LearningSessionPhase.evaluating ||
      LearningSessionPhase.feedbackReady ||
      LearningSessionPhase.generatingNote => 'Resume recall session',
      LearningSessionPhase.complete => 'Open completed session',
      _ =>
        allSources.isEmpty
            ? 'Upload your first document'
            : 'Start a learning session',
    };

    final continueSubtitle = continueSession == null
        ? 'Upload material, pick a chapter or page range, read it, then prove you learned it.'
        : '${continueSession.sourceTitle} - ${continueSession.sectionTitle}';
    final createSessionPath = allSources.isNotEmpty
        ? '/session?sourceId=${allSources.first.id}'
        : '/session';

    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.ink, AppColors.ocean],
                  ),
                  borderRadius: BorderRadius.circular(36),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.ocean.withValues(alpha: 0.16),
                      blurRadius: 36,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'DictaCoach',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.sun,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Prove you learned it.',
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Upload a document. Read one focused section. Hide the text. Retell it from memory. Earn the note.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Colors.white.withValues(alpha: 0.82),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.ink,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                          vertical: AppSpacing.md,
                        ),
                      ),
                      onPressed: () {
                        if (continueSession != null) {
                          context.go('/session');
                          return;
                        }

                        context.go(createSessionPath);
                      },
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: Text(
                        continueSession == null
                            ? 'Continue learning'
                            : continueLabel,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      continueSubtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (isWide)
                Row(
                  children: [
                    Expanded(
                      child: _WorkflowActionCard(
                        title: 'Upload document',
                        description:
                            'Add a PDF or paste text, let the app split it into chapters or sections, and prepare it for study sessions.',
                        buttonLabel: 'Open Upload',
                        icon: Icons.upload_file_outlined,
                        accent: AppColors.sun,
                        onPressed: () => context.go('/session'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _WorkflowActionCard(
                        title: 'Create session',
                        description: allSources.isEmpty
                            ? 'Upload a document first, then choose the exact section or pages you want to learn today.'
                            : 'Pick the part you want today, choose assisted or strict mode, and go straight into focused reading.',
                        buttonLabel: allSources.isEmpty
                            ? 'Upload First'
                            : 'Choose Section',
                        icon: Icons.auto_stories_outlined,
                        accent: AppColors.mint,
                        onPressed: () => context.go(createSessionPath),
                      ),
                    ),
                  ],
                )
              else
                Column(
                  children: [
                    _WorkflowActionCard(
                      title: 'Upload document',
                      description:
                          'Add a PDF or paste text, let the app split it into chapters or sections, and prepare it for study sessions.',
                      buttonLabel: 'Open Upload',
                      icon: Icons.upload_file_outlined,
                      accent: AppColors.sun,
                      onPressed: () => context.go('/session'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _WorkflowActionCard(
                      title: 'Create session',
                      description: allSources.isEmpty
                          ? 'Upload a document first, then choose the exact section or pages you want to learn today.'
                          : 'Pick the part you want today, choose assisted or strict mode, and go straight into focused reading.',
                      buttonLabel: allSources.isEmpty
                          ? 'Upload First'
                          : 'Choose Section',
                      icon: Icons.auto_stories_outlined,
                      accent: AppColors.mint,
                      onPressed: () => context.go(createSessionPath),
                    ),
                  ],
                ),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: [
                  _MetricCard(
                    label: 'Sessions today',
                    value: '${progress.sessionsToday}',
                    icon: Icons.local_fire_department_outlined,
                    accent: AppColors.coral,
                  ),
                  _MetricCard(
                    label: 'Streak',
                    value: '${progress.streak} days',
                    icon: Icons.bolt_outlined,
                    accent: AppColors.sun,
                  ),
                  _MetricCard(
                    label: 'Weak areas',
                    value: '${progress.lowScoreCount}',
                    icon: Icons.track_changes_outlined,
                    accent: AppColors.mint,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 6,
                      child: _TopicsPanel(topics: activeTopics),
                    ),
                    const SizedBox(width: AppSpacing.lg),
                    Expanded(
                      flex: 4,
                      child: _WeakConceptsPanel(weakConcepts: weakConcepts),
                    ),
                  ],
                )
              else ...[
                _TopicsPanel(topics: activeTopics),
                const SizedBox(height: AppSpacing.lg),
                _WeakConceptsPanel(weakConcepts: weakConcepts),
              ],
              const SizedBox(height: AppSpacing.lg),
              _LatestReviewPanel(
                noteId: latestNote?.id,
                updatedAt: latestNote?.updatedAt,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(28),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: AppColors.ink),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _WorkflowActionCard extends StatelessWidget {
  const _WorkflowActionCard({
    required this.title,
    required this.description,
    required this.buttonLabel,
    required this.icon,
    required this.accent,
    required this.onPressed,
  });

  final String title;
  final String description;
  final String buttonLabel;
  final IconData icon;
  final Color accent;
  final VoidCallback onPressed;

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
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: AppColors.ink),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(description),
          const SizedBox(height: AppSpacing.md),
          FilledButton.tonalIcon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(buttonLabel),
          ),
        ],
      ),
    );
  }
}

class _TopicsPanel extends StatelessWidget {
  const _TopicsPanel({required this.topics});

  final List<LearningSource> topics;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active topics',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Pick a topic, choose the section you want today, and move straight into a focused session.',
          ),
          const SizedBox(height: AppSpacing.md),
          if (topics.isEmpty)
            const Text(
              'No active topics yet. Import a PDF or paste text to create your first learning source.',
            )
          else
            for (final topic in topics) ...[
              _TopicCard(source: topic),
              const SizedBox(height: AppSpacing.md),
            ],
        ],
      ),
    );
  }
}

class _TopicCard extends StatelessWidget {
  const _TopicCard({required this.source});

  final LearningSource source;

  @override
  Widget build(BuildContext context) {
    final totalMinutes = source.sections.fold<int>(
      0,
      (value, section) => value + section.estimatedReadMinutes,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.ink.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            source.title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(source.subtitle),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(source.type.label)),
              Chip(label: Text('${source.sections.length} sections')),
              Chip(label: Text('$totalMinutes min total')),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.tonalIcon(
            onPressed: () => context.go('/session?sourceId=${source.id}'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: const Text('Choose section'),
          ),
        ],
      ),
    );
  }
}

class _WeakConceptsPanel extends StatelessWidget {
  const _WeakConceptsPanel({required this.weakConcepts});

  final List<String> weakConcepts;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Weak concepts',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            weakConcepts.isEmpty
                ? 'Your missed concepts will surface here after a few sessions.'
                : 'These are resurfacing because your recall attempts missed them.',
          ),
          if (weakConcepts.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final concept in weakConcepts)
                  Chip(
                    avatar: const Icon(Icons.priority_high_rounded, size: 18),
                    label: Text(concept),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _LatestReviewPanel extends ConsumerWidget {
  const _LatestReviewPanel({required this.noteId, required this.updatedAt});

  final String? noteId;
  final DateTime? updatedAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (noteId == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(32),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Review library',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Passed sessions generate corrected notes here so the user reviews what they understood and what they missed.',
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () => context.go('/library'),
              icon: const Icon(Icons.library_books_outlined),
              label: const Text('Open review library'),
            ),
          ],
        ),
      );
    }

    final note = ref.watch(noteProvider(noteId!)).asData?.value;

    if (note == null) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Latest earned note',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            note.cleanedTitle,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(note.cleanedSummary),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (updatedAt != null)
                Chip(label: Text(formatDateTime(updatedAt!))),
              for (final term in note.keyTerms.take(3)) Chip(label: Text(term)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.tonalIcon(
            onPressed: () => context.go('/notes/${note.id}'),
            icon: const Icon(Icons.open_in_new_outlined),
            label: const Text('Open note'),
          ),
        ],
      ),
    );
  }
}
