import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../widgets/empty_state_card.dart';
import '../../widgets/status_chip.dart';

class NoteDetailScreen extends ConsumerWidget {
  const NoteDetailScreen({super.key, required this.noteId});

  final String noteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final note = ref.watch(noteProvider(noteId)).asData?.value;

    if (note == null) {
      return const EmptyStateCard(
        title: 'Note not found',
        message: 'The requested note is unavailable or still loading.',
        icon: Icons.description_outlined,
      );
    }

    final folder = note.folderId == null
        ? null
        : ref.watch(folderByIdProvider(note.folderId!));
    final relatedNotes = ref.watch(relatedNotesProvider(noteId));

    return SelectionArea(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextButton.icon(
              onPressed: () => context.go('/library'),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to review library'),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                StatusChip(status: note.aiProcessingStatus),
                if (folder != null) Chip(label: Text(folder.title)),
                Chip(label: Text(formatDateTime(note.updatedAt))),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              note.cleanedTitle,
              style: Theme.of(
                context,
              ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            Text(
              note.cleanedSummary,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: AppColors.ink.withValues(alpha: 0.82),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _SectionCard(
              title: 'Key ideas',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final idea in note.keyIdeas)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 4),
                            child: Icon(
                              Icons.arrow_right_alt,
                              color: AppColors.ocean,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(child: Text(idea)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _SectionCard(
              title: 'Cleaned content',
              child: Text(
                note.cleanedContent,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _SectionCard(
              title: 'Review prompts',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final question in note.reviewQuestions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Text('- $question'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _SectionCard(
              title: 'Terms, tags, and topics',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final term in note.keyTerms) Chip(label: Text(term)),
                  for (final tag in note.tags) Chip(label: Text('#$tag')),
                  for (final topic in note.topics) Chip(label: Text(topic)),
                ],
              ),
            ),
            if (relatedNotes.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              _SectionCard(
                title: 'Related notes',
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    for (final related in relatedNotes)
                      ActionChip(
                        label: Text(related.cleanedTitle),
                        onPressed: () => context.go('/notes/${related.id}'),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const Text('Raw transcript'),
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(note.rawTranscript),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

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
          child,
        ],
      ),
    );
  }
}
