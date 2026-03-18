import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/design_system/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../domain/models/recording_phase.dart';
import '../../../application/recording/recording_state.dart';
import '../../../presentation/widgets/empty_state_card.dart';
import '../../../presentation/widgets/processing_status_banner.dart';

class CaptureScreen extends ConsumerWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(recordingControllerProvider);
    final controller = ref.read(recordingControllerProvider.notifier);
    final latestNote = ref.watch(latestNoteProvider);

    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'DictaCoach',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.ocean,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 10),
              Text(
                'Speak first. Study later.',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                'Capture a voice note, transcribe it, transform it into a structured study note, and drop it into the right folder with related links.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (kIsWeb)
                const Padding(
                  padding: EdgeInsets.only(bottom: AppSpacing.md),
                  child: EmptyStateCard(
                    title: 'Web stays read-focused',
                    message:
                        'Use Android or iOS to record. The web app is intentionally optimized for browsing notes and folders.',
                    icon: Icons.phone_android_outlined,
                  ),
                ),
              _RecorderHero(
                state: state,
                onPrimaryPressed: () {
                  switch (state.phase) {
                    case RecordingPhase.unsupported:
                      context.go('/library');
                      break;
                    case RecordingPhase.idle:
                    case RecordingPhase.saved:
                    case RecordingPhase.error:
                      controller.startRecording();
                      break;
                    case RecordingPhase.recording:
                      controller.pauseRecording();
                      break;
                    case RecordingPhase.paused:
                      controller.resumeRecording();
                      break;
                    case RecordingPhase.review:
                      controller.saveRecording();
                      break;
                    case RecordingPhase.uploading:
                    case RecordingPhase.transcribing:
                    case RecordingPhase.generating:
                    case RecordingPhase.organizing:
                    case RecordingPhase.saving:
                      break;
                  }
                },
                onStopPressed: controller.stopRecording,
                onDiscardPressed: controller.discardRecording,
              ),
              const SizedBox(height: AppSpacing.lg),
              ProcessingStatusBanner(
                phase: state.phase,
                message: state.statusMessage,
                errorMessage: state.errorMessage,
              ),
              if (state.lastSavedNoteId != null) ...[
                const SizedBox(height: AppSpacing.md),
                FilledButton.icon(
                  onPressed: () => context.go('/notes/${state.lastSavedNoteId}'),
                  icon: const Icon(Icons.open_in_new_outlined),
                  label: const Text('Open last saved note'),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              if (latestNote != null)
                _LatestNotePanel(noteId: latestNote.id)
              else
                const EmptyStateCard(
                  title: 'Your first note will land here',
                  message:
                      'Once you save a recording, DictaCoach will show the latest structured note and its linked context.',
                  icon: Icons.auto_stories_outlined,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecorderHero extends StatelessWidget {
  const _RecorderHero({
    required this.state,
    required this.onPrimaryPressed,
    required this.onStopPressed,
    required this.onDiscardPressed,
  });

  final RecordingState state;
  final VoidCallback onPrimaryPressed;
  final VoidCallback onStopPressed;
  final VoidCallback onDiscardPressed;

  @override
  Widget build(BuildContext context) {
    final isBusy = state.isBusy;
    final phase = state.phase;
    final elapsed = state.elapsed;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.ink,
            AppColors.ocean,
            AppColors.mint,
          ],
        ),
        borderRadius: BorderRadius.circular(36),
        boxShadow: [
          BoxShadow(
            color: AppColors.ocean.withValues(alpha: 0.22),
            blurRadius: 32,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            phase.label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.82),
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 10),
          Text(
            formatElapsed(elapsed),
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Recording elapsed time',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.76),
                ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _WaveStrip(seed: elapsed.inMilliseconds, active: phase == RecordingPhase.recording),
          const SizedBox(height: AppSpacing.xl),
          Center(
            child: GestureDetector(
              onTap: isBusy ? null : onPrimaryPressed,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: 196,
                height: 196,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.24),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.14),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Icon(
                  _primaryIconForPhase(phase),
                  size: 72,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.tonalIcon(
                onPressed: (phase == RecordingPhase.recording ||
                        phase == RecordingPhase.paused)
                    ? onStopPressed
                    : null,
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('Stop'),
              ),
              OutlinedButton.icon(
                onPressed: phase == RecordingPhase.review ||
                        phase == RecordingPhase.recording ||
                        phase == RecordingPhase.paused
                    ? onDiscardPressed
                    : null,
                icon: const Icon(Icons.delete_outline),
                label: const Text('Discard'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _primaryIconForPhase(RecordingPhase phase) {
    return switch (phase) {
      RecordingPhase.unsupported => Icons.menu_book_outlined,
      RecordingPhase.idle => Icons.mic_none_rounded,
      RecordingPhase.recording => Icons.pause_rounded,
      RecordingPhase.paused => Icons.play_arrow_rounded,
      RecordingPhase.review => Icons.auto_awesome,
      RecordingPhase.saved => Icons.mic_none_rounded,
      RecordingPhase.error => Icons.refresh_rounded,
      _ => Icons.auto_awesome,
    };
  }
}

class _WaveStrip extends StatelessWidget {
  const _WaveStrip({
    required this.seed,
    required this.active,
  });

  final int seed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var index = 0; index < 22; index++) ...[
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              margin: const EdgeInsets.symmetric(horizontal: 2),
              height: active ? 10 + ((seed ~/ 120 + index * 13) % 44).toDouble() : 10,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: active ? 0.82 : 0.28),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _LatestNotePanel extends ConsumerWidget {
  const _LatestNotePanel({
    required this.noteId,
  });

  final String noteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final note = ref.watch(noteProvider(noteId)).asData?.value;
    final folder = note?.folderId == null
        ? null
        : ref.watch(folderByIdProvider(note?.folderId ?? ''));

    if (note == null) {
      return const SizedBox.shrink();
    }

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
            'Latest note',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Text(
            note.cleanedTitle,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
          Text(note.cleanedSummary),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (folder != null) Chip(label: Text(folder.title)),
              for (final topic in note.topics.take(3))
                Chip(label: Text(topic)),
            ],
          ),
        ],
      ),
    );
  }
}
