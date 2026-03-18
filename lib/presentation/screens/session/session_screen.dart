import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../application/sessions/session_flow_state.dart';
import '../../../core/design_system/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../domain/models/learning_session.dart';
import '../../../domain/models/learning_source.dart';
import '../../../domain/models/study_note.dart';

class SessionScreen extends ConsumerStatefulWidget {
  const SessionScreen({super.key, this.sourceId});

  final String? sourceId;

  @override
  ConsumerState<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends ConsumerState<SessionScreen> {
  late final TextEditingController _titleController;
  late final TextEditingController _subtitleController;
  late final TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _subtitleController = TextEditingController();
    _textController = TextEditingController();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _subtitleController.dispose();
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SessionFlowState>(sessionFlowControllerProvider, (
      previous,
      next,
    ) {
      if (!mounted) {
        return;
      }

      if (previous?.errorMessage != next.errorMessage &&
          next.errorMessage != null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(next.errorMessage!)));
      }
    });

    final flow = ref.watch(sessionFlowControllerProvider);
    final controller = ref.read(sessionFlowControllerProvider.notifier);
    final sources =
        ref.watch(sourcesProvider).asData?.value ?? const <LearningSource>[];
    final orderedSources = _prioritizeSources(sources, widget.sourceId);
    final activeSession = flow.activeSession;
    final section = activeSession == null
        ? null
        : ref.watch(
            sourceSectionProvider((
              sourceId: activeSession.sourceId,
              sectionId: activeSession.sectionId,
            )),
          );
    final latestGeneratedNoteId =
        activeSession?.noteId ?? flow.lastGeneratedNoteId;
    final generatedNote = latestGeneratedNoteId == null
        ? null
        : ref.watch(noteProvider(latestGeneratedNoteId)).asData?.value;
    final isWide = MediaQuery.sizeOf(context).width >= 1040;

    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                activeSession == null
                    ? 'Create a learning session'
                    : 'Active recall session',
                style: Theme.of(
                  context,
                ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                activeSession == null
                    ? 'Upload a PDF or text source, pick the chapter you want today, and let the app prepare the recall gate in the background.'
                    : 'The reading comes first. Then the text disappears and the user has to retell it from memory.',
              ),
              const SizedBox(height: AppSpacing.lg),
              _StatusStrip(
                message: flow.statusMessage,
                isBusy: flow.isImporting || flow.isWorking,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (activeSession == null)
                _SessionSetupView(
                  isWide: isWide,
                  isImporting: flow.isImporting,
                  sources: orderedSources,
                  onPickFile: controller.importFromFilePicker,
                  onImportText: _handleImportText,
                  titleController: _titleController,
                  subtitleController: _subtitleController,
                  textController: _textController,
                  onStartSession:
                      ({
                        required LearningSource source,
                        required LearningSection section,
                        required LearningSessionMode mode,
                      }) async {
                        await controller.createSession(
                          source: source,
                          section: section,
                          mode: mode,
                        );
                      },
                )
              else
                _ActiveSessionView(
                  isWide: isWide,
                  session: activeSession,
                  section: section,
                  recorderSupported: controller.recorderSupported,
                  flow: flow,
                  generatedNote: generatedNote,
                  onReady: controller.markReadingComplete,
                  onStartRecall: controller.startRecallRecording,
                  onStopRecall: controller.stopRecallRecording,
                  onDiscardRecall: controller.discardRecallAttempt,
                  onSubmitRecall: controller.submitRecallAttempt,
                  onRetryRecall: controller.retryRecall,
                  onPass: controller.passAndGenerateNote,
                  onReset: controller.clearActiveSession,
                ),
            ],
          ),
        ),
      ),
    );
  }

  List<LearningSource> _prioritizeSources(
    List<LearningSource> sources,
    String? sourceId,
  ) {
    if (sourceId == null) {
      return sources;
    }

    final sorted = [...sources];
    sorted.sort((a, b) {
      if (a.id == sourceId) {
        return -1;
      }
      if (b.id == sourceId) {
        return 1;
      }
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return sorted;
  }

  Future<void> _handleImportText() async {
    final title = _titleController.text.trim();
    final subtitle = _subtitleController.text.trim();
    final text = _textController.text.trim();

    if (title.isEmpty || text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add a title and some text before importing.'),
        ),
      );
      return;
    }

    await ref
        .read(sessionFlowControllerProvider.notifier)
        .importPastedText(
          title: title,
          subtitle: subtitle.isEmpty ? 'Pasted study material' : subtitle,
          text: text,
        );

    if (!mounted) {
      return;
    }

    _titleController.clear();
    _subtitleController.clear();
    _textController.clear();
  }
}

class _SessionSetupView extends StatelessWidget {
  const _SessionSetupView({
    required this.isWide,
    required this.isImporting,
    required this.sources,
    required this.onPickFile,
    required this.onImportText,
    required this.titleController,
    required this.subtitleController,
    required this.textController,
    required this.onStartSession,
  });

  final bool isWide;
  final bool isImporting;
  final List<LearningSource> sources;
  final Future<void> Function() onPickFile;
  final Future<void> Function() onImportText;
  final TextEditingController titleController;
  final TextEditingController subtitleController;
  final TextEditingController textController;
  final Future<void> Function({
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  })
  onStartSession;

  @override
  Widget build(BuildContext context) {
    final importPanel = _ImportPanel(
      isImporting: isImporting,
      onPickFile: onPickFile,
      onImportText: onImportText,
      titleController: titleController,
      subtitleController: subtitleController,
      textController: textController,
    );

    final sourcesPanel = _SourcePickerPanel(
      sources: sources,
      onStartSession: onStartSession,
    );

    if (!isWide) {
      return Column(
        children: [
          importPanel,
          const SizedBox(height: AppSpacing.lg),
          sourcesPanel,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 5, child: importPanel),
        const SizedBox(width: AppSpacing.lg),
        Expanded(flex: 6, child: sourcesPanel),
      ],
    );
  }
}

class _ImportPanel extends StatelessWidget {
  const _ImportPanel({
    required this.isImporting,
    required this.onPickFile,
    required this.onImportText,
    required this.titleController,
    required this.subtitleController,
    required this.textController,
  });

  final bool isImporting;
  final Future<void> Function() onPickFile;
  final Future<void> Function() onImportText;
  final TextEditingController titleController;
  final TextEditingController subtitleController;
  final TextEditingController textController;

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
            'Upload',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Start with a PDF or text. The parser breaks it into sections so the user can choose only the pages or chapter they want today.',
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: isImporting ? null : onPickFile,
            icon: const Icon(Icons.upload_file_outlined),
            label: Text(isImporting ? 'Importing...' : 'Pick PDF or text file'),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Or paste text directly',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: titleController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Source title',
              hintText: 'Biology chapter 3',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: subtitleController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Subtitle',
              hintText: 'Pages 42-56 or your own note',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: textController,
            minLines: 10,
            maxLines: 14,
            decoration: const InputDecoration(
              alignLabelWithHint: true,
              labelText: 'Study material',
              hintText:
                  'Paste the exact text the user should read before recall.',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.tonalIcon(
            onPressed: isImporting ? null : onImportText,
            icon: const Icon(Icons.auto_awesome_outlined),
            label: const Text('Parse into sections'),
          ),
          const SizedBox(height: AppSpacing.lg),
          const _LoopReminder(),
        ],
      ),
    );
  }
}

class _SourcePickerPanel extends StatelessWidget {
  const _SourcePickerPanel({
    required this.sources,
    required this.onStartSession,
  });

  final List<LearningSource> sources;
  final Future<void> Function({
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  })
  onStartSession;

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
            'Choose what to learn today',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'The session always starts with a section selection. That keeps reading time intentional and makes scoring fair.',
          ),
          const SizedBox(height: AppSpacing.md),
          if (sources.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.paper,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Text(
                'Imported sources will appear here. Seeded demo topics are available in demo mode as soon as the repository loads.',
              ),
            )
          else
            for (final source in sources) ...[
              _SourceCard(source: source, onStartSession: onStartSession),
              const SizedBox(height: AppSpacing.md),
            ],
        ],
      ),
    );
  }
}

class _SourceCard extends StatelessWidget {
  const _SourceCard({required this.source, required this.onStartSession});

  final LearningSource source;
  final Future<void> Function({
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  })
  onStartSession;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.ink.withValues(alpha: 0.06)),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        childrenPadding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        title: Text(
          source.title,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(source.subtitle),
        trailing: Chip(label: Text('${source.sections.length} sections')),
        children: [
          for (final section in source.sections) ...[
            _SectionActionCard(
              section: section,
              onAssisted: () => onStartSession(
                source: source,
                section: section,
                mode: LearningSessionMode.assisted,
              ),
              onStrict: () => onStartSession(
                source: source,
                section: section,
                mode: LearningSessionMode.strict,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}

class _SectionActionCard extends StatelessWidget {
  const _SectionActionCard({
    required this.section,
    required this.onAssisted,
    required this.onStrict,
  });

  final LearningSection section;
  final VoidCallback onAssisted;
  final VoidCallback onStrict;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(section.pageLabel),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text('${section.estimatedReadMinutes} min read')),
              Chip(label: Text(section.difficulty.label)),
              Chip(label: Text('${section.conceptCount} concepts')),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                onPressed: onAssisted,
                icon: const Icon(Icons.auto_awesome_outlined),
                label: const Text('Assisted'),
              ),
              OutlinedButton.icon(
                onPressed: onStrict,
                icon: const Icon(Icons.gpp_good_outlined),
                label: const Text('Strict'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LoopReminder extends StatelessWidget {
  const _LoopReminder();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: const [
          Chip(label: Text('Upload')),
          Chip(label: Text('Read')),
          Chip(label: Text('Recall')),
          Chip(label: Text('Feedback')),
          Chip(label: Text('Retry')),
          Chip(label: Text('Note')),
          Chip(label: Text('Review')),
        ],
      ),
    );
  }
}

class _ActiveSessionView extends StatelessWidget {
  const _ActiveSessionView({
    required this.isWide,
    required this.session,
    required this.section,
    required this.recorderSupported,
    required this.flow,
    required this.generatedNote,
    required this.onReady,
    required this.onStartRecall,
    required this.onStopRecall,
    required this.onDiscardRecall,
    required this.onSubmitRecall,
    required this.onRetryRecall,
    required this.onPass,
    required this.onReset,
  });

  final bool isWide;
  final LearningSession session;
  final LearningSection? section;
  final bool recorderSupported;
  final SessionFlowState flow;
  final StudyNote? generatedNote;
  final Future<void> Function() onReady;
  final Future<void> Function() onStartRecall;
  final Future<void> Function() onStopRecall;
  final Future<void> Function() onDiscardRecall;
  final Future<void> Function() onSubmitRecall;
  final Future<void> Function() onRetryRecall;
  final Future<void> Function() onPass;
  final Future<void> Function() onReset;

  @override
  Widget build(BuildContext context) {
    final phaseContent = switch (session.phase) {
      LearningSessionPhase.reading => _ReadingPhase(
        session: session,
        section: section,
        readingElapsed: flow.readingElapsed,
        onReady: onReady,
      ),
      LearningSessionPhase.readyToRecall ||
      LearningSessionPhase.recordingRecall ||
      LearningSessionPhase.reviewRecording => _RecallPhase(
        session: session,
        recallElapsed: flow.recallElapsed,
        recorderSupported: recorderSupported,
        onStartRecall: onStartRecall,
        onStopRecall: onStopRecall,
        onDiscardRecall: onDiscardRecall,
        onSubmitRecall: onSubmitRecall,
      ),
      LearningSessionPhase.transcribing ||
      LearningSessionPhase.evaluating ||
      LearningSessionPhase.generatingNote => _ProcessingPhase(session: session),
      LearningSessionPhase.feedbackReady => _FeedbackPhase(
        session: session,
        onRetryRecall: onRetryRecall,
        onPass: onPass,
      ),
      LearningSessionPhase.complete => _CompletePhase(
        note: generatedNote,
        session: session,
        onReset: onReset,
      ),
      LearningSessionPhase.error => _ErrorPhase(onReset: onReset),
      _ => const SizedBox.shrink(),
    };

    if (!isWide) {
      return Column(
        children: [
          _SessionHeader(session: session, section: section),
          const SizedBox(height: AppSpacing.lg),
          phaseContent,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 4,
          child: _SessionHeader(session: session, section: section),
        ),
        const SizedBox(width: AppSpacing.lg),
        Expanded(flex: 7, child: phaseContent),
      ],
    );
  }
}

class _SessionHeader extends StatelessWidget {
  const _SessionHeader({required this.session, required this.section});

  final LearningSession session;
  final LearningSection? section;

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
          Chip(label: Text(session.phase.label)),
          const SizedBox(height: AppSpacing.md),
          Text(
            session.sourceTitle,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            session.sectionTitle,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppColors.ink.withValues(alpha: 0.78),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(session.mode.label)),
              Chip(
                label: Text(
                  '${session.targetReadDuration.inMinutes} min target',
                ),
              ),
              if (section != null) Chip(label: Text(section!.difficulty.label)),
              if (section != null)
                Chip(label: Text('${section!.conceptCount} concepts')),
              Chip(label: Text('Attempt ${session.attemptCount + 1}')),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('Session rule', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'The user does not get the note until they cross the recall threshold. That keeps the note earned instead of passively consumed.',
          ),
        ],
      ),
    );
  }
}

class _ReadingPhase extends StatelessWidget {
  const _ReadingPhase({
    required this.session,
    required this.section,
    required this.readingElapsed,
    required this.onReady,
  });

  final LearningSession session;
  final LearningSection? section;
  final Duration readingElapsed;
  final Future<void> Function() onReady;

  @override
  Widget build(BuildContext context) {
    final targetSeconds = session.targetReadDuration.inSeconds.clamp(1, 36000);
    final progress = (readingElapsed.inSeconds / targetSeconds)
        .clamp(0.0, 1.0)
        .toDouble();

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
            'Reading phase',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Read first. No note-taking here. The goal is to understand enough that you can later explain it without the text in front of you.',
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.ink, AppColors.ocean],
              ),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatElapsed(readingElapsed),
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Reading elapsed time',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.76),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                LinearProgressIndicator(
                  value: progress,
                  minHeight: 10,
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(999),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Chip(
                      backgroundColor: Colors.white,
                      label: Text(
                        'Normal pace: ${session.targetReadDuration.inMinutes} min',
                      ),
                    ),
                    if (section != null)
                      Chip(
                        backgroundColor: Colors.white,
                        label: Text(section!.difficulty.label),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.paper,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Text(
              session.sourceText,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: () => onReady(),
            icon: const Icon(Icons.visibility_off_outlined),
            label: const Text("I'm Ready"),
          ),
        ],
      ),
    );
  }
}

class _RecallPhase extends StatelessWidget {
  const _RecallPhase({
    required this.session,
    required this.recallElapsed,
    required this.recorderSupported,
    required this.onStartRecall,
    required this.onStopRecall,
    required this.onDiscardRecall,
    required this.onSubmitRecall,
  });

  final LearningSession session;
  final Duration recallElapsed;
  final bool recorderSupported;
  final Future<void> Function() onStartRecall;
  final Future<void> Function() onStopRecall;
  final Future<void> Function() onDiscardRecall;
  final Future<void> Function() onSubmitRecall;

  @override
  Widget build(BuildContext context) {
    final isRecording = session.phase == LearningSessionPhase.recordingRecall;
    final isReview = session.phase == LearningSessionPhase.reviewRecording;
    final canStart = session.phase == LearningSessionPhase.readyToRecall;

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
            'Recall phase',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            session.recallPrompt,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'The text is hidden now. Pull from memory, use your own wording, and aim for definitions, examples, distinctions, and edge cases.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          if (!recorderSupported)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.paper,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Text(
                'Voice recall recording needs a supported mobile device microphone.',
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.ink, AppColors.ocean],
                ),
                borderRadius: BorderRadius.circular(32),
              ),
              child: Column(
                children: [
                  Text(
                    formatElapsed(recallElapsed),
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isRecording
                        ? 'Retelling from memory'
                        : isReview
                        ? 'Attempt ready for scoring'
                        : 'Tap the mic when the user is ready',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.78),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _WaveStrip(
                    seed: recallElapsed.inMilliseconds,
                    active: isRecording,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  GestureDetector(
                    onTap: !recorderSupported
                        ? null
                        : canStart
                        ? () => onStartRecall()
                        : isRecording
                        ? () => onStopRecall()
                        : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: 188,
                      height: 188,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.14),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.24),
                          width: 1.5,
                        ),
                      ),
                      child: Icon(
                        canStart
                            ? Icons.mic_none_rounded
                            : isRecording
                            ? Icons.stop_rounded
                            : Icons.check_rounded,
                        size: 72,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              if (canStart)
                FilledButton.icon(
                  onPressed: recorderSupported ? onStartRecall : null,
                  icon: const Icon(Icons.mic_none_rounded),
                  label: const Text('Start retelling'),
                ),
              if (isRecording)
                FilledButton.icon(
                  onPressed: () => onStopRecall(),
                  icon: const Icon(Icons.stop_circle_outlined),
                  label: const Text('Stop retelling'),
                ),
              if (isReview)
                FilledButton.icon(
                  onPressed: () => onSubmitRecall(),
                  icon: const Icon(Icons.analytics_outlined),
                  label: const Text('Score this attempt'),
                ),
              if (isReview)
                OutlinedButton.icon(
                  onPressed: () => onDiscardRecall(),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Discard attempt'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProcessingPhase extends StatelessWidget {
  const _ProcessingPhase({required this.session});

  final LearningSession session;

  @override
  Widget build(BuildContext context) {
    final steps = <({String label, bool complete, bool active})>[
      (
        label: 'Speech to text',
        complete: session.phase.index > LearningSessionPhase.transcribing.index,
        active: session.phase == LearningSessionPhase.transcribing,
      ),
      (
        label: 'Compare against source',
        complete: session.phase.index > LearningSessionPhase.evaluating.index,
        active: session.phase == LearningSessionPhase.evaluating,
      ),
      (
        label: 'Generate corrected note',
        complete:
            session.phase.index > LearningSessionPhase.generatingNote.index,
        active: session.phase == LearningSessionPhase.generatingNote,
      ),
    ];

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
            'AI processing',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'The evaluator compares the recall transcript with the original reading, then the note generator builds a corrected review note only if the user passed the gate.',
          ),
          const SizedBox(height: AppSpacing.lg),
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: CircularProgressIndicator(),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          for (final step in steps) ...[
            _ProcessingStepRow(step: step),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

class _ProcessingStepRow extends StatelessWidget {
  const _ProcessingStepRow({required this.step});

  final ({String label, bool complete, bool active}) step;

  @override
  Widget build(BuildContext context) {
    final color = step.complete
        ? AppColors.success
        : step.active
        ? AppColors.ocean
        : AppColors.ink.withValues(alpha: 0.18);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Icon(
            step.complete
                ? Icons.check_circle_rounded
                : step.active
                ? Icons.hourglass_top_rounded
                : Icons.radio_button_unchecked_rounded,
            color: color,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(step.label)),
        ],
      ),
    );
  }
}

class _FeedbackPhase extends StatelessWidget {
  const _FeedbackPhase({
    required this.session,
    required this.onRetryRecall,
    required this.onPass,
  });

  final LearningSession session;
  final Future<void> Function() onRetryRecall;
  final Future<void> Function() onPass;

  @override
  Widget build(BuildContext context) {
    final feedback = session.feedback!;

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
            'Feedback',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            feedback.canPass
                ? 'Passed. The user cleared the recall gate and can now turn this into a corrected note.'
                : 'Below threshold. The user should retry before the note is unlocked.',
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              _ScoreCard(
                label: 'Total score',
                value: '${feedback.breakdown.totalScore}/100',
                accent: feedback.canPass ? AppColors.success : AppColors.coral,
              ),
              _ScoreCard(
                label: 'Recall',
                value: '${feedback.breakdown.recallScore}/100',
                accent: AppColors.ocean,
              ),
              _ScoreCard(
                label: 'Accuracy',
                value: '${feedback.breakdown.accuracyScore}/100',
                accent: AppColors.mint,
              ),
              _ScoreCard(
                label: 'Detail',
                value: '${feedback.breakdown.detailScore}/100',
                accent: AppColors.sun,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _FeedbackListCard(
            title: 'Specific feedback',
            items: feedback.specificFeedback,
          ),
          const SizedBox(height: AppSpacing.md),
          if (feedback.strengths.isNotEmpty) ...[
            _FeedbackListCard(title: 'What worked', items: feedback.strengths),
            const SizedBox(height: AppSpacing.md),
          ],
          _FeedbackListCard(
            title: 'Missing pieces',
            items: feedback.missingPieces.isEmpty
                ? const ['No major gaps were detected.']
                : feedback.missingPieces,
          ),
          const SizedBox(height: AppSpacing.md),
          _FeedbackListCard(
            title: 'Misconceptions',
            items: feedback.misconceptions.isEmpty
                ? const ['No unsupported claims were detected.']
                : feedback.misconceptions,
          ),
          if ((session.recallTranscript ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const Text('Recall transcript'),
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.paper,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(session.recallTranscript!),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                onPressed: feedback.canPass ? onPass : onRetryRecall,
                icon: Icon(
                  feedback.canPass
                      ? Icons.note_add_outlined
                      : Icons.refresh_rounded,
                ),
                label: Text(
                  feedback.canPass ? 'Generate note' : 'Retry recall',
                ),
              ),
              if (feedback.canPass)
                OutlinedButton.icon(
                  onPressed: () => onRetryRecall(),
                  icon: const Icon(Icons.mic_none_rounded),
                  label: const Text('Retry anyway'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.paper,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _FeedbackListCard extends StatelessWidget {
  const _FeedbackListCard({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.md),
          for (final item in items) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Icon(Icons.circle, size: 8, color: AppColors.ink),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(item)),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

class _CompletePhase extends StatelessWidget {
  const _CompletePhase({
    required this.note,
    required this.session,
    required this.onReset,
  });

  final StudyNote? note;
  final LearningSession session;
  final Future<void> Function() onReset;

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
            'Session complete',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'The note is now saved with the user recall preserved, the missing concepts corrected, and future review prompts attached.',
          ),
          const SizedBox(height: AppSpacing.lg),
          if (note != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.paper,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    note!.cleanedTitle,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(note!.cleanedSummary),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final term in note!.keyTerms.take(4))
                        Chip(label: Text(term)),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              if (note != null)
                FilledButton.icon(
                  onPressed: () => context.go('/notes/${note!.id}'),
                  icon: const Icon(Icons.open_in_new_outlined),
                  label: const Text('Open note'),
                ),
              OutlinedButton.icon(
                onPressed: () => context.go('/library'),
                icon: const Icon(Icons.library_books_outlined),
                label: const Text('Open review library'),
              ),
              OutlinedButton.icon(
                onPressed: () => onReset(),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Start another session'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorPhase extends StatelessWidget {
  const _ErrorPhase({required this.onReset});

  final Future<void> Function() onReset;

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
            'Something broke in the loop',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Reset this session and start again. Provider interfaces are already isolated, so backend failures can be swapped or retried later without rewriting the UI.',
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: () => onReset(),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Reset session'),
          ),
        ],
      ),
    );
  }
}

class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.message, required this.isBusy});

  final String message;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Icon(
            isBusy ? Icons.hourglass_top_rounded : Icons.bolt_rounded,
            color: isBusy ? AppColors.ocean : AppColors.success,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _WaveStrip extends StatelessWidget {
  const _WaveStrip({required this.seed, required this.active});

  final int seed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var index = 0; index < 22; index++)
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              margin: const EdgeInsets.symmetric(horizontal: 2),
              height: active
                  ? 10 + ((seed ~/ 120 + index * 13) % 44).toDouble()
                  : 12,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: active ? 0.82 : 0.24),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
      ],
    );
  }
}
