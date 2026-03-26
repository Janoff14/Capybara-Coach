import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum _WorkflowStage {
  welcome,
  source,
  session,
  reading,
  recall,
  processing,
  feedback,
  note,
}

class WorkflowStudioScreen extends StatefulWidget {
  const WorkflowStudioScreen({super.key});

  @override
  State<WorkflowStudioScreen> createState() => _WorkflowStudioScreenState();
}

class _WorkflowStudioScreenState extends State<WorkflowStudioScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _pasteController = TextEditingController();
  final TextEditingController _recallController = TextEditingController();

  late final List<_StudioDocument> _documents;
  final List<_GeneratedNote> _savedNotes = <_GeneratedNote>[];

  _WorkflowStage _stage = _WorkflowStage.welcome;
  String? _selectedDocumentId;
  int _selectedSectionIndex = 0;
  bool _showWorkflow = true;
  bool _isRecording = false;
  String? _statusMessage;
  String? _lastUploadedFileName;
  int _noteSeed = 0;

  _EvaluationResult? _evaluation;
  _GeneratedNote? _generatedNote;
  String? _selectedSavedNoteId;

  final Stopwatch _readingStopwatch = Stopwatch();
  final Stopwatch _recallStopwatch = Stopwatch();
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _documents = _sampleDocuments();
    if (_documents.isNotEmpty) {
      _selectedDocumentId = _documents.first.id;
      _titleController.text = _documents.first.title;
      _subjectController.text = _documents.first.subject;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _titleController.dispose();
    _subjectController.dispose();
    _pasteController.dispose();
    _recallController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isWide = size.width >= 1180;
    final selectedDocument = _documentById(_selectedDocumentId);
    final selectedSection = selectedDocument == null
        ? null
        : selectedDocument.sections[_selectedSectionIndex.clamp(
            0,
            selectedDocument.sections.length - 1,
          )];

    return Scaffold(
      backgroundColor: const Color(0xFFF1EEE6),
      body: Stack(
        children: [
          const _GlassBackdrop(),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
                  child: Row(
                    children: [
                      _topBadge('Glass OS Web Prototype'),
                      const SizedBox(width: 10),
                      _topBadge(_stageTitle(_stage)),
                      const Spacer(),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            _showWorkflow = !_showWorkflow;
                          });
                        },
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.58),
                          foregroundColor: const Color(0xFF3E4C3B),
                        ),
                        icon: Icon(
                          _showWorkflow
                              ? Icons.view_sidebar_outlined
                              : Icons.view_day_outlined,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: isWide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_showWorkflow)
                                SizedBox(
                                  width: 300,
                                  child: _buildWorkflowRail(selectedDocument),
                                ),
                              if (_showWorkflow) const SizedBox(width: 20),
                              Expanded(
                                flex: 15,
                                child: _GlassPanel(
                                  padding: const EdgeInsets.all(26),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Capybara Coach',
                                        style: GoogleFonts.outfit(
                                          fontSize: 32,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF131711),
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        'A local website prototype for the full study loop: upload, choose section, read with timer, recall, feedback, note, review.',
                                        style: GoogleFonts.manrope(
                                          fontSize: 15,
                                          height: 1.7,
                                          color: const Color(0xFF4D5748),
                                        ),
                                      ),
                                      if (_statusMessage != null) ...[
                                        const SizedBox(height: 12),
                                        Text(
                                          _statusMessage!,
                                          style: GoogleFonts.manrope(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFF66715F),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 22),
                                      Expanded(
                                        child: AnimatedSwitcher(
                                          duration: const Duration(milliseconds: 280),
                                          child: _buildStage(
                                            selectedDocument,
                                            selectedSection,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 20),
                              SizedBox(
                                width: 340,
                                child: _buildReviewRail(selectedDocument),
                              ),
                            ],
                          )
                        : ListView(
                            children: [
                              _GlassPanel(
                                padding: const EdgeInsets.all(24),
                                child: SizedBox(
                                  height: 960,
                                  child: _buildStage(
                                    selectedDocument,
                                    selectedSection,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (_showWorkflow) _buildWorkflowRail(selectedDocument),
                              if (_showWorkflow) const SizedBox(height: 20),
                              _buildReviewRail(selectedDocument),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStage(
    _StudioDocument? selectedDocument,
    _StudioSection? selectedSection,
  ) {
    switch (_stage) {
      case _WorkflowStage.welcome:
        return _buildWelcomeStage();
      case _WorkflowStage.source:
        return _buildSourceStage(selectedDocument);
      case _WorkflowStage.session:
        return _buildSessionStage(selectedDocument);
      case _WorkflowStage.reading:
        return _buildReadingStage(selectedDocument, selectedSection);
      case _WorkflowStage.recall:
        return _buildRecallStage(selectedDocument, selectedSection);
      case _WorkflowStage.processing:
        return _buildProcessingStage();
      case _WorkflowStage.feedback:
        return _buildFeedbackStage(selectedDocument, selectedSection);
      case _WorkflowStage.note:
        return _buildNoteStage(selectedDocument, selectedSection);
    }
  }

  Widget _buildWorkflowRail(_StudioDocument? selectedDocument) {
    return Column(
      children: [
        _GlassPanel(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Workflow map',
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF171C16),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'I added one missing product step from your chart: choose the exact section before the reading timer begins.',
                style: GoogleFonts.manrope(
                  fontSize: 13.5,
                  height: 1.6,
                  color: const Color(0xFF566151),
                ),
              ),
              const SizedBox(height: 18),
              for (final step in _workflowSteps(selectedDocument))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _WorkflowTile(step: step),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _GlassPanel(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Prototype scope',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF171C16),
                ),
              ),
              const SizedBox(height: 14),
              _featureLine(Icons.upload_file_outlined, 'Import text-like files'),
              _featureLine(Icons.auto_stories_outlined, 'Choose section/pages for today'),
              _featureLine(Icons.timer_outlined, 'Visible reading and recall timers'),
              _featureLine(Icons.analytics_outlined, 'Local heuristic scoring'),
              _featureLine(Icons.note_alt_outlined, 'Generate and save review notes'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReviewRail(_StudioDocument? selectedDocument) {
    final currentNote = _generatedNote ??
        (_selectedSavedNoteId == null
            ? (_savedNotes.isEmpty ? null : _savedNotes.last)
            : _savedNotes.firstWhere(
                (note) => note.id == _selectedSavedNoteId,
                orElse: () => _savedNotes.last,
              ));

    return Column(
      children: [
        _GlassPanel(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Live session readout',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF171C16),
                ),
              ),
              const SizedBox(height: 16),
              _metricRow('Document', selectedDocument?.title ?? 'None yet'),
              _metricRow('Reading timer', _formatDuration(_readingStopwatch.elapsed)),
              _metricRow('Recall timer', _formatDuration(_recallStopwatch.elapsed)),
              _metricRow('Saved notes', '${_savedNotes.length}'),
              if (_evaluation != null)
                _metricRow('Latest score', '${_evaluation!.totalScore}/100'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Expanded(
          child: _GlassPanel(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Review notes',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF171C16),
                  ),
                ),
                const SizedBox(height: 16),
                if (_savedNotes.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text(
                        'Generate and save a note to populate the review rail.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          height: 1.6,
                          color: const Color(0xFF576252),
                        ),
                      ),
                    ),
                  )
                else ...[
                  SizedBox(
                    height: 126,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _savedNotes.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 12),
                      itemBuilder: (context, index) {
                        final note = _savedNotes.reversed.toList()[index];
                        final isActive = currentNote?.id == note.id;
                        return _MiniNoteTile(
                          note: note,
                          isActive: isActive,
                          onTap: () {
                            setState(() {
                              _selectedSavedNoteId = note.id;
                              _generatedNote = null;
                            });
                          },
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (currentNote != null)
                    Expanded(
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              currentNote.title,
                              style: GoogleFonts.outfit(
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF171C16),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              currentNote.summary,
                              style: GoogleFonts.manrope(
                                fontSize: 14,
                                height: 1.7,
                                color: const Color(0xFF556050),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWelcomeStage() {
    return Center(
      key: const ValueKey('welcome-stage'),
      child: Row(
        children: [
          Expanded(
            flex: 11,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'A sleek glass workspace for learning by recall.',
                  style: GoogleFonts.outfit(
                    fontSize: 58,
                    height: 1.02,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF161A15),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Import a document, choose today’s section, read with a visible timer, explain it from memory, get scored, and save the corrected note.',
                  style: GoogleFonts.manrope(
                    fontSize: 17,
                    height: 1.75,
                    color: const Color(0xFF4D5748),
                  ),
                ),
                const SizedBox(height: 26),
                Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    _PrimaryActionButton(
                      label: 'Enter Prototype',
                      icon: Icons.arrow_forward_rounded,
                      onPressed: () {
                        setState(() {
                          _stage = _WorkflowStage.source;
                          _statusMessage =
                              'Signed in as a local demo learner. Start with a source.';
                        });
                      },
                    ),
                    _SecondaryActionButton(
                      label: 'Use Sample Material',
                      icon: Icons.auto_stories_outlined,
                      onPressed: () {
                        setState(() {
                          _stage = _WorkflowStage.source;
                          _statusMessage =
                              'Sample sources are loaded. Choose one or import your own.';
                        });
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 24),
          const Expanded(
            flex: 8,
            child: _HeroCluster(),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceStage(_StudioDocument? selectedDocument) {
    return SingleChildScrollView(
      key: const ValueKey('source-stage'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _innerPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionHeader(
                        '01',
                        'Choose study material',
                        'Pick a sample or import your own document text for the local web demo.',
                      ),
                      const SizedBox(height: 18),
                      for (final document in _documents)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _DocumentCard(
                            document: document,
                            isSelected: _selectedDocumentId == document.id,
                            onTap: () {
                              setState(() {
                                _selectedDocumentId = document.id;
                                _selectedSectionIndex = 0;
                                _titleController.text = document.title;
                                _subjectController.text = document.subject;
                                _statusMessage =
                                    'Loaded ${document.title}. Continue into session setup.';
                              });
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _innerPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionHeader(
                        '02',
                        'Import material',
                        'Text-like files and pasted text work in this local frontend. PDF extraction can be added next.',
                      ),
                      const SizedBox(height: 16),
                      _label('Document title'),
                      const SizedBox(height: 8),
                      _glassField(
                        controller: _titleController,
                        hintText: 'Systems Biology Module 4',
                      ),
                      const SizedBox(height: 14),
                      _label('Subject / topic'),
                      const SizedBox(height: 8),
                      _glassField(
                        controller: _subjectController,
                        hintText: 'Biology, networking, psychology',
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _SecondaryActionButton(
                              label: 'Import Text File',
                              icon: Icons.upload_file_outlined,
                              onPressed: _pickTextFile,
                            ),
                          ),
                          const SizedBox(width: 12),
                          if (_lastUploadedFileName != null)
                            Expanded(
                              child: Text(
                                _lastUploadedFileName!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.manrope(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF65705F),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _label('Paste source text'),
                      const SizedBox(height: 8),
                      _glassField(
                        controller: _pasteController,
                        hintText:
                            'Paste the article, chapter, notes, or study material here...',
                        maxLines: 10,
                      ),
                      const SizedBox(height: 16),
                      _PrimaryActionButton(
                        label: 'Create Local Document',
                        icon: Icons.library_add_rounded,
                        onPressed: _createLocalDocument,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (selectedDocument != null) ...[
            const SizedBox(height: 18),
            _innerPanel(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${selectedDocument.title} is ready with ${selectedDocument.sections.length} section${selectedDocument.sections.length == 1 ? '' : 's'}.',
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF33402F),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _PrimaryActionButton(
                    label: 'Choose Section',
                    icon: Icons.chevron_right_rounded,
                    onPressed: () {
                      setState(() {
                        _stage = _WorkflowStage.session;
                        _statusMessage =
                            'Choose what part of the material the learner studies today.';
                      });
                    },
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSessionStage(_StudioDocument? selectedDocument) {
    if (selectedDocument == null) {
      return _emptyState(
        'Pick a document first',
        'The session setup stage needs a selected source.',
        'Back to Sources',
        () {
          setState(() {
            _stage = _WorkflowStage.source;
          });
        },
      );
    }

    final selectedSection = selectedDocument.sections[_selectedSectionIndex];
    return SingleChildScrollView(
      key: const ValueKey('session-stage'),
      child: _innerPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader(
              '03',
              'Create the study session',
              'This is the extra step your original chart needed: choose the exact section or pages before reading begins.',
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: selectedDocument.sections.asMap().entries.map((entry) {
                return _SectionPill(
                  section: entry.value,
                  isSelected: entry.key == _selectedSectionIndex,
                  onTap: () {
                    setState(() {
                      _selectedSectionIndex = entry.key;
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 18),
            _SectionPreview(section: selectedSection),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: _SecondaryActionButton(
                    label: 'Back to Sources',
                    icon: Icons.arrow_back_rounded,
                    onPressed: () {
                      setState(() {
                        _stage = _WorkflowStage.source;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _PrimaryActionButton(
                    label: 'Start Reading',
                    icon: Icons.chrome_reader_mode_rounded,
                    onPressed: _startReading,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReadingStage(
    _StudioDocument? selectedDocument,
    _StudioSection? selectedSection,
  ) {
    if (selectedDocument == null || selectedSection == null) {
      return const SizedBox.shrink();
    }

    return Column(
      key: const ValueKey('reading-stage'),
      children: [
        Row(
          children: [
            Expanded(
              child: _sectionHeader(
                '04',
                'Focused reading mode',
                'The timer is visible. Once finished, the text is hidden and the learner moves into recall.',
              ),
            ),
            const SizedBox(width: 16),
            _metricChip('Reading', _formatDuration(_readingStopwatch.elapsed)),
            const SizedBox(width: 10),
            _metricChip('Target', '${selectedSection.estimatedReadMinutes} min'),
          ],
        ),
        const SizedBox(height: 18),
        Expanded(
          child: _innerPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _capsule(selectedDocument.title),
                    _capsule(selectedSection.title),
                    _capsule(selectedSection.difficulty),
                    _capsule('${selectedSection.conceptCount} concepts'),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  selectedSection.title,
                  style: GoogleFonts.outfit(
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF171B16),
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: SingleChildScrollView(
                    child: Text(
                      selectedSection.content,
                      style: GoogleFonts.manrope(
                        fontSize: 17,
                        height: 1.85,
                        color: const Color(0xFF2C3429),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _SecondaryActionButton(
                        label: 'Switch Section',
                        icon: Icons.swap_horiz_rounded,
                        onPressed: () {
                          _stopTimers();
                          setState(() {
                            _stage = _WorkflowStage.session;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _PrimaryActionButton(
                        label: 'Finish Reading / I’m Ready',
                        icon: Icons.arrow_forward_rounded,
                        onPressed: _finishReading,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecallStage(
    _StudioDocument? selectedDocument,
    _StudioSection? selectedSection,
  ) {
    if (selectedDocument == null || selectedSection == null) {
      return const SizedBox.shrink();
    }

    return SingleChildScrollView(
      key: const ValueKey('recall-stage'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _sectionHeader(
                  '05',
                  'Retell it from memory',
                  'For this local prototype, the record button is the main interaction and the typed transcript is what we score.',
                ),
              ),
              const SizedBox(width: 16),
              _metricChip('Recall', _formatDuration(_recallStopwatch.elapsed)),
            ],
          ),
          const SizedBox(height: 18),
          _innerPanel(
            child: Column(
              children: [
                Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: _isRecording
                          ? const [Color(0xFF6A8D5E), Color(0xFF92AF84)]
                          : const [Color(0xFFE7EFE0), Color(0xFFDDE8D3)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6A8D5E).withValues(alpha: 0.22),
                        blurRadius: 46,
                        offset: const Offset(0, 24),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isRecording ? Icons.mic_rounded : Icons.mic_none_rounded,
                    size: 88,
                    color: _isRecording
                        ? const Color(0xFFF9FBF6)
                        : const Color(0xFF365033),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  _isRecording ? 'Recording' : 'Ready to capture recall',
                  style: GoogleFonts.outfit(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF181D17),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Explain the section in your own words, mention core definitions, relationships, and any important examples you remember.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 14.5,
                    height: 1.7,
                    color: const Color(0xFF54604F),
                  ),
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  alignment: WrapAlignment.center,
                  children: [
                    _SecondaryActionButton(
                      label: _isRecording ? 'Pause' : 'Start Recording',
                      icon: _isRecording
                          ? Icons.pause_circle_outline_rounded
                          : Icons.play_circle_outline_rounded,
                      onPressed: _toggleRecording,
                    ),
                    _PrimaryActionButton(
                      label: 'Submit Recall',
                      icon: Icons.check_circle_outline_rounded,
                      onPressed: _submitRecall,
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                _label('Recall transcript for the local prototype'),
                const SizedBox(height: 8),
                _glassField(
                  controller: _recallController,
                  hintText:
                      'Type or paste the learner’s spoken recall here for local evaluation...',
                  maxLines: 8,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProcessingStage() {
    return Center(
      key: const ValueKey('processing-stage'),
      child: _innerPanel(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 46),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 54,
                height: 54,
                child: CircularProgressIndicator(
                  strokeWidth: 3.2,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6A8D5E)),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Processing the attempt',
                style: GoogleFonts.outfit(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF171C16),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'This stands in for speech-to-text, source comparison, scoring, and note generation.',
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(
                  fontSize: 15,
                  height: 1.7,
                  color: const Color(0xFF566151),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeedbackStage(
    _StudioDocument? selectedDocument,
    _StudioSection? selectedSection,
  ) {
    final evaluation = _evaluation;
    if (selectedDocument == null || selectedSection == null || evaluation == null) {
      return const SizedBox.shrink();
    }

    return SingleChildScrollView(
      key: const ValueKey('feedback-stage'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader(
            '06',
            'Feedback and scoring',
            'This screen should win or lose trust. It shows the score, what the learner missed, and whether retrying is the right move.',
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _innerPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${evaluation.totalScore}',
                        style: GoogleFonts.outfit(
                          fontSize: 72,
                          height: 1,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF192019),
                        ),
                      ),
                      Text(
                        'Overall score / 100',
                        style: GoogleFonts.manrope(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF677260),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _scoreBar('Recall', evaluation.recallScore),
                      const SizedBox(height: 12),
                      _scoreBar('Accuracy', evaluation.accuracyScore),
                      const SizedBox(height: 12),
                      _scoreBar('Detail', evaluation.detailScore),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _innerPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        evaluation.totalScore >= 70
                            ? 'Pass gate reached'
                            : 'Retry recommended',
                        style: GoogleFonts.outfit(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF191D17),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        evaluation.summary,
                        style: GoogleFonts.manrope(
                          fontSize: 14.5,
                          height: 1.75,
                          color: const Color(0xFF556050),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _feedbackCard(
                  'What landed',
                  const Color(0xFFE7F0E1),
                  const Color(0xFF355036),
                  evaluation.strengths,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _feedbackCard(
                  'Missing pieces',
                  const Color(0xFFF4ECD9),
                  const Color(0xFF8B6A2A),
                  evaluation.missingPieces,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _feedbackCard(
                  'Misconceptions',
                  const Color(0xFFF4E4E2),
                  const Color(0xFF904F4B),
                  evaluation.misconceptions,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _SecondaryActionButton(
                  label: 'Retry Explanation',
                  icon: Icons.replay_rounded,
                  onPressed: () {
                    setState(() {
                      _stage = _WorkflowStage.recall;
                      _generatedNote = null;
                    });
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _PrimaryActionButton(
                  label: evaluation.totalScore >= 70
                      ? 'Generate Study Note'
                      : 'Generate Anyway',
                  icon: Icons.auto_awesome_rounded,
                  onPressed: _generateNote,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNoteStage(
    _StudioDocument? selectedDocument,
    _StudioSection? selectedSection,
  ) {
    final note = _generatedNote;
    if (selectedDocument == null || selectedSection == null || note == null) {
      return const SizedBox.shrink();
    }

    return SingleChildScrollView(
      key: const ValueKey('note-stage'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader(
            '07',
            'Generated note',
            'The note keeps accurate learner phrasing where possible, then corrects and fills the missing material from the source.',
          ),
          const SizedBox(height: 18),
          _innerPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [for (final tag in note.tags) _capsule(tag)],
                ),
                const SizedBox(height: 16),
                Text(
                  note.title,
                  style: GoogleFonts.outfit(
                    fontSize: 38,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF181D17),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  note.summary,
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    height: 1.75,
                    color: const Color(0xFF4D5748),
                  ),
                ),
                const SizedBox(height: 18),
                _contentBlock('Key points', note.keyPoints),
                const SizedBox(height: 16),
                _contentBlock('Memory correction layer', note.corrections),
                const SizedBox(height: 16),
                _contentBlock('Review prompts', note.reviewQuestions),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _SecondaryActionButton(
                        label: 'Retry for Better Score',
                        icon: Icons.replay_circle_filled_rounded,
                        onPressed: () {
                          setState(() {
                            _stage = _WorkflowStage.recall;
                            _generatedNote = null;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _PrimaryActionButton(
                        label: 'Save to Review',
                        icon: Icons.bookmark_add_outlined,
                        onPressed: _saveNote,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickTextFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['txt', 'md', 'json', 'csv'],
    );
    if (result == null || result.files.isEmpty) {
      return;
    }

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      setState(() {
        _statusMessage = 'Could not read the selected file in the browser.';
      });
      return;
    }

    setState(() {
      _lastUploadedFileName = file.name;
      _pasteController.text = _decodeBytes(bytes);
      _titleController.text =
          _titleController.text.trim().isEmpty ? _stem(file.name) : _titleController.text;
      _statusMessage =
          '${file.name} loaded into the local prototype. Review and create the document.';
    });
  }

  void _createLocalDocument() {
    final rawText = _pasteController.text.trim();
    final title = _titleController.text.trim();
    final subject = _subjectController.text.trim();
    if (title.isEmpty || rawText.isEmpty) {
      setState(() {
        _statusMessage =
            'Add a title and either paste source text or import a file first.';
      });
      return;
    }

    final document = _StudioDocument(
      id: 'local-${DateTime.now().microsecondsSinceEpoch}',
      title: title,
      subject: subject.isEmpty ? 'General study' : subject,
      sections: _chunkIntoSections(rawText),
    );

    setState(() {
      _documents.insert(0, document);
      _selectedDocumentId = document.id;
      _selectedSectionIndex = 0;
      _pasteController.clear();
      _lastUploadedFileName = null;
      _statusMessage =
          'Created ${document.title}. Continue into session setup to choose the section.';
    });
  }

  void _startReading() {
    _stopTimers();
    _readingStopwatch
      ..reset()
      ..start();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
    setState(() {
      _stage = _WorkflowStage.reading;
      _evaluation = null;
      _generatedNote = null;
      _recallController.clear();
      _recallStopwatch.reset();
      _statusMessage =
          'Reading timer is now running. Once the learner is ready, switch to recall.';
    });
  }

  void _finishReading() {
    _readingStopwatch.stop();
    setState(() {
      _stage = _WorkflowStage.recall;
      _statusMessage =
          'Reading is complete. The next step is memory recall, not rereading.';
    });
  }

  void _toggleRecording() {
    setState(() {
      _isRecording = !_isRecording;
      if (_isRecording) {
        _recallStopwatch.start();
        _ticker ??= Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) {
            setState(() {});
          }
        });
        _statusMessage =
            'Recording started. For the local prototype, the transcript is typed below.';
      } else {
        _recallStopwatch.stop();
        _statusMessage = 'Recording paused.';
      }
    });
  }

  Future<void> _submitRecall() async {
    final document = _documentById(_selectedDocumentId);
    if (document == null) {
      return;
    }
    final section = document.sections[_selectedSectionIndex];
    final recall = _recallController.text.trim();
    if (recall.isEmpty) {
      setState(() {
        _statusMessage =
            'The local frontend still needs a recall transcript to score the attempt.';
      });
      return;
    }

    _isRecording = false;
    _recallStopwatch.stop();
    setState(() {
      _stage = _WorkflowStage.processing;
      _statusMessage =
          'Running local heuristic scoring to simulate transcription and AI comparison.';
    });

    await Future<void>.delayed(const Duration(milliseconds: 1100));
    final evaluation = _evaluateRecall(section.content, recall);

    if (!mounted) {
      return;
    }
    setState(() {
      _evaluation = evaluation;
      _stage = _WorkflowStage.feedback;
      _statusMessage = 'Feedback is ready. Retry or generate the corrected note.';
    });
  }

  Future<void> _generateNote() async {
    final document = _documentById(_selectedDocumentId);
    final evaluation = _evaluation;
    if (document == null || evaluation == null) {
      return;
    }

    setState(() {
      _stage = _WorkflowStage.processing;
      _statusMessage =
          'Generating a corrected note that keeps the learner’s wording when accurate.';
    });

    await Future<void>.delayed(const Duration(milliseconds: 900));
    final section = document.sections[_selectedSectionIndex];
    final note = _buildNote(document, section, _recallController.text.trim(), evaluation);
    if (!mounted) {
      return;
    }

    setState(() {
      _generatedNote = note;
      _stage = _WorkflowStage.note;
      _statusMessage = 'Generated note is ready. Save it into the review rail.';
    });
  }

  void _saveNote() {
    final note = _generatedNote;
    if (note == null) {
      return;
    }

    final saved = note.copyWith(
      id: 'saved-note-${_noteSeed++}',
      savedAt: DateTime.now(),
    );
    setState(() {
      _savedNotes.add(saved);
      _selectedSavedNoteId = saved.id;
      _generatedNote = saved;
      _statusMessage =
          'Saved locally. The review rail now reflects the completed loop.';
    });
  }

  void _stopTimers() {
    _readingStopwatch.stop();
    _recallStopwatch.stop();
    _ticker?.cancel();
    _ticker = null;
  }

  _StudioDocument? _documentById(String? id) {
    if (id == null) {
      return null;
    }
    for (final document in _documents) {
      if (document.id == id) {
        return document;
      }
    }
    return null;
  }
}

class _StudioDocument {
  const _StudioDocument({
    required this.id,
    required this.title,
    required this.subject,
    required this.sections,
  });

  final String id;
  final String title;
  final String subject;
  final List<_StudioSection> sections;
}

class _StudioSection {
  const _StudioSection({
    required this.title,
    required this.content,
    required this.estimatedReadMinutes,
    required this.difficulty,
    required this.conceptCount,
  });

  final String title;
  final String content;
  final int estimatedReadMinutes;
  final String difficulty;
  final int conceptCount;
}

class _EvaluationResult {
  const _EvaluationResult({
    required this.totalScore,
    required this.recallScore,
    required this.accuracyScore,
    required this.detailScore,
    required this.summary,
    required this.strengths,
    required this.missingPieces,
    required this.misconceptions,
  });

  final int totalScore;
  final int recallScore;
  final int accuracyScore;
  final int detailScore;
  final String summary;
  final List<String> strengths;
  final List<String> missingPieces;
  final List<String> misconceptions;
}

class _GeneratedNote {
  const _GeneratedNote({
    required this.id,
    required this.title,
    required this.summary,
    required this.tags,
    required this.keyPoints,
    required this.corrections,
    required this.reviewQuestions,
    required this.savedAt,
  });

  final String id;
  final String title;
  final String summary;
  final List<String> tags;
  final List<String> keyPoints;
  final List<String> corrections;
  final List<String> reviewQuestions;
  final DateTime savedAt;

  _GeneratedNote copyWith({String? id, DateTime? savedAt}) {
    return _GeneratedNote(
      id: id ?? this.id,
      title: title,
      summary: summary,
      tags: tags,
      keyPoints: keyPoints,
      corrections: corrections,
      reviewQuestions: reviewQuestions,
      savedAt: savedAt ?? this.savedAt,
    );
  }
}

class _WorkflowStepState {
  const _WorkflowStepState({
    required this.title,
    required this.subtitle,
    required this.status,
  });

  final String title;
  final String subtitle;
  final _WorkflowStatus status;
}

enum _WorkflowStatus { done, active, upcoming }

class _GlassBackdrop extends StatelessWidget {
  const _GlassBackdrop();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFF4F1EA),
                  Color(0xFFE6E1D7),
                  Color(0xFFECE8DF),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          top: -120,
          left: -40,
          child: _orb(const Color(0xFF8BB17D).withValues(alpha: 0.28), 300),
        ),
        Positioned(
          top: 120,
          right: -120,
          child: _orb(const Color(0xFFE4CC9F).withValues(alpha: 0.32), 360),
        ),
        Positioned(
          bottom: -160,
          left: 280,
          child: _orb(const Color(0xFF93A8C0).withValues(alpha: 0.18), 320),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(painter: _GridPainter()),
          ),
        ),
      ],
    );
  }

  Widget _orb(Color color, double size) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const spacing = 32.0;
    final paint = Paint()
      ..color = const Color(0xFF94A08D).withValues(alpha: 0.08)
      ..strokeWidth = 1;
    for (double x = 0; x <= size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y <= size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    this.padding = const EdgeInsets.all(24),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(32),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.68),
                Colors.white.withValues(alpha: 0.42),
              ],
            ),
            border: Border.all(color: Colors.white.withValues(alpha: 0.58)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF313C2C).withValues(alpha: 0.08),
                blurRadius: 48,
                offset: const Offset(0, 24),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _PrimaryActionButton extends StatelessWidget {
  const _PrimaryActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label, style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF6A8D5E),
          foregroundColor: const Color(0xFFF7FBF2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        ),
      ),
    );
  }
}

class _SecondaryActionButton extends StatelessWidget {
  const _SecondaryActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label, style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF394734),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.72)),
          backgroundColor: Colors.white.withValues(alpha: 0.46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        ),
      ),
    );
  }
}

class _WorkflowTile extends StatelessWidget {
  const _WorkflowTile({required this.step});

  final _WorkflowStepState step;

  @override
  Widget build(BuildContext context) {
    final tone = switch (step.status) {
      _WorkflowStatus.done => const Color(0xFF6A8D5E),
      _WorkflowStatus.active => const Color(0xFFBF9659),
      _WorkflowStatus.upcoming => const Color(0xFFCBD2C8),
    };
    final icon = switch (step.status) {
      _WorkflowStatus.done => Icons.check_rounded,
      _WorkflowStatus.active => Icons.play_arrow_rounded,
      _WorkflowStatus.upcoming => Icons.circle_outlined,
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.62)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 18, color: tone),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF21261F),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  step.subtitle,
                  style: GoogleFonts.manrope(
                    fontSize: 12.5,
                    height: 1.55,
                    color: const Color(0xFF5A6555),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.document,
    required this.isSelected,
    required this.onTap,
  });

  final _StudioDocument document;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFEAF2E4)
              : Colors.white.withValues(alpha: 0.48),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected
                ? const Color(0xFFABC49A)
                : Colors.white.withValues(alpha: 0.58),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFDCE8D2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.description_outlined, color: Color(0xFF345034)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    document.title,
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF1A2119),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${document.subject} · ${document.sections.length} sections',
                    style: GoogleFonts.manrope(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF606C5B),
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: Color(0xFF6A8D5E)),
          ],
        ),
      ),
    );
  }
}

class _SectionPill extends StatelessWidget {
  const _SectionPill({
    required this.section,
    required this.isSelected,
    required this.onTap,
  });

  final _StudioSection section;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFEAF2E4)
              : Colors.white.withValues(alpha: 0.44),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isSelected
                ? const Color(0xFFAFC6A3)
                : Colors.white.withValues(alpha: 0.58),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              section.title,
              style: GoogleFonts.manrope(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1F261D),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${section.estimatedReadMinutes} min · ${section.difficulty} · ${section.conceptCount} concepts',
              style: GoogleFonts.manrope(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF667060),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionPreview extends StatelessWidget {
  const _SectionPreview({required this.section});

  final _StudioSection section;

  @override
  Widget build(BuildContext context) {
    final preview = section.content.length <= 420
        ? section.content
        : '${section.content.substring(0, 420).trim()}...';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.title,
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF1C211B),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            preview,
            style: GoogleFonts.manrope(
              fontSize: 14,
              height: 1.75,
              color: const Color(0xFF54604F),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniNoteTile extends StatelessWidget {
  const _MiniNoteTile({
    required this.note,
    required this.isActive,
    required this.onTap,
  });

  final _GeneratedNote note;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        width: 184,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFFE9F0E3)
              : Colors.white.withValues(alpha: 0.42),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isActive
                ? const Color(0xFFA8BE9D)
                : Colors.white.withValues(alpha: 0.58),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              note.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF182018),
              ),
            ),
            const Spacer(),
            Text(
              '${note.savedAt.hour.toString().padLeft(2, '0')}:${note.savedAt.minute.toString().padLeft(2, '0')}',
              style: GoogleFonts.manrope(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF6A7564),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _topBadge(String label) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(999),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.56),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.42)),
        ),
        child: Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF42503F),
          ),
        ),
      ),
    ),
  );
}

Widget _featureLine(IconData icon, String label) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0xFFE7EFE0),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 18, color: const Color(0xFF3F5238)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 13.2,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF2B332A),
            ),
          ),
        ),
      ],
    ),
  );
}

Widget _metricRow(String label, String value) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF596454),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF1D221C),
            ),
          ),
        ),
      ],
    ),
  );
}

Widget _innerPanel({required Widget child}) {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.48),
      borderRadius: BorderRadius.circular(26),
      border: Border.all(color: Colors.white.withValues(alpha: 0.66)),
    ),
    padding: const EdgeInsets.all(22),
    child: child,
  );
}

Widget _sectionHeader(String eyebrow, String title, String subtitle) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        eyebrow,
        style: GoogleFonts.manrope(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
          color: const Color(0xFF6A7B63),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        title,
        style: GoogleFonts.outfit(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF171B16),
        ),
      ),
      const SizedBox(height: 10),
      Text(
        subtitle,
        style: GoogleFonts.manrope(
          fontSize: 14.5,
          height: 1.7,
          color: const Color(0xFF566151),
        ),
      ),
    ],
  );
}

Widget _label(String label) {
  return Text(
    label,
    style: GoogleFonts.manrope(
      fontSize: 13,
      fontWeight: FontWeight.w800,
      color: const Color(0xFF5C6958),
    ),
  );
}

Widget _glassField({
  required TextEditingController controller,
  required String hintText,
  int maxLines = 1,
}) {
  return TextField(
    controller: controller,
    maxLines: maxLines,
    minLines: maxLines == 1 ? 1 : maxLines,
    style: GoogleFonts.manrope(
      fontSize: 14.5,
      height: 1.6,
      color: const Color(0xFF1B201A),
    ),
    decoration: InputDecoration(
      hintText: hintText,
      hintStyle: GoogleFonts.manrope(
        fontSize: 14.5,
        height: 1.6,
        color: const Color(0xFF869280),
      ),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.52),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.65)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: Color(0xFF6A8D5E), width: 1.4),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
  );
}

Widget _metricChip(String label, String value) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.54),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: Colors.white.withValues(alpha: 0.58)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF6A7564),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1D221C),
          ),
        ),
      ],
    ),
  );
}

Widget _capsule(String label) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.52),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: Colors.white.withValues(alpha: 0.62)),
    ),
    child: Text(
      label,
      style: GoogleFonts.manrope(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF455142),
      ),
    ),
  );
}

Widget _scoreBar(String label, int value) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF3B4836),
            ),
          ),
          const Spacer(),
          Text(
            '$value%',
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF697565),
            ),
          ),
        ],
      ),
      const SizedBox(height: 8),
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          value: value / 100,
          minHeight: 10,
          backgroundColor: const Color(0xFFD7DED2),
          valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6A8D5E)),
        ),
      ),
    ],
  );
}

Widget _feedbackCard(String title, Color background, Color accent, List<String> items) {
  return Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: accent,
          ),
        ),
        const SizedBox(height: 14),
        for (final item in items.take(4))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: Icon(Icons.circle, size: 6, color: accent),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    item,
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      height: 1.65,
                      color: const Color(0xFF384336),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

Widget _contentBlock(String title, List<String> lines) {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.48),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: Colors.white.withValues(alpha: 0.62)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF171B16),
          ),
        ),
        const SizedBox(height: 12),
        for (final line in lines.take(4))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 7),
                  child: Icon(Icons.circle, size: 6, color: Color(0xFF587154)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    line,
                    style: GoogleFonts.manrope(
                      fontSize: 14,
                      height: 1.7,
                      color: const Color(0xFF465042),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

Widget _emptyState(
  String title,
  String subtitle,
  String actionLabel,
  VoidCallback onPressed,
) {
  return Center(
    child: _innerPanel(
      child: SizedBox(
        width: 520,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 30,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF181E18),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 14,
                height: 1.7,
                color: const Color(0xFF5A6454),
              ),
            ),
            const SizedBox(height: 18),
            _PrimaryActionButton(
              label: actionLabel,
              icon: Icons.arrow_back_rounded,
              onPressed: onPressed,
            ),
          ],
        ),
      ),
    ),
  );
}

class _HeroCluster extends StatelessWidget {
  const _HeroCluster();

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      child: AspectRatio(
        aspectRatio: 0.92,
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              child: _heroCard(
                180,
                'Read',
                'Timer, section selection, focused document view',
                Icons.chrome_reader_mode_rounded,
                const Color(0xFFF0D7AE),
              ),
            ),
            Positioned(
              right: 0,
              top: 58,
              child: _heroCard(
                180,
                'Recall',
                'Retell in your own words after the text disappears',
                Icons.mic_none_rounded,
                const Color(0xFFD9E9D0),
              ),
            ),
            Positioned(
              left: 38,
              bottom: 0,
              child: _heroCard(
                210,
                'Corrected Note',
                'Save the learner’s phrasing when it is accurate',
                Icons.note_alt_outlined,
                const Color(0xFFD9E3F3),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroCard(
    double width,
    String title,
    String subtitle,
    IconData icon,
    Color tint,
  ) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.56),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: tint,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: const Color(0xFF263024)),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF182018),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: GoogleFonts.manrope(
              fontSize: 13.5,
              height: 1.6,
              color: const Color(0xFF566151),
            ),
          ),
        ],
      ),
    );
  }
}

List<_StudioDocument> _sampleDocuments() {
  return [
    _StudioDocument(
      id: 'sample-systems',
      title: 'Biological Systems of Internal Calm',
      subject: 'Life sciences',
      sections: _chunkIntoSections(
        'In deep exploration of entropy, free energy, and non-equilibrium states within cellular environments, this session focuses on bridging physics and microbiology.\n\n'
        'Cells maintain local order by pushing disorder into their surroundings. This requires energy intake, constant molecular exchange, and adaptive regulation across membranes.\n\n'
        'Membrane potential is a form of stored electrochemical tension. It allows cells to control nutrient movement, signaling behavior, and mechanical responses to the environment.\n\n'
        'When regulation fails, entropy rises locally and biological performance drops. Homeostasis is therefore not static balance, but an active, energy-consuming process.',
      ),
    ),
    _StudioDocument(
      id: 'sample-networking',
      title: 'Networking Basics',
      subject: 'Computer science',
      sections: _chunkIntoSections(
        'TCP establishes a connection through a three-way handshake and provides reliable, ordered delivery by retransmitting lost packets.\n\n'
        'HTTP is an application-layer protocol where a request includes a method, path, headers, and optionally a body. It is stateless by default.\n\n'
        'DNS translates domain names into IP addresses so clients can locate services without remembering numerical addresses.\n\n'
        'Routers inspect destination information and forward packets between networks according to routing tables.',
      ),
    ),
    _StudioDocument(
      id: 'sample-psychology',
      title: 'Cognitive Behavioral Foundations',
      subject: 'Psychology',
      sections: _chunkIntoSections(
        'Cognitive behavioral therapy proposes that emotional reactions are strongly shaped by interpretations rather than events alone.\n\n'
        'Automatic thoughts are rapid evaluations that can reinforce anxiety, shame, or avoidance if they are inaccurate or unchallenged.\n\n'
        'Cognitive restructuring helps the learner identify distorted thinking, compare it against evidence, and replace it with a more balanced interpretation.\n\n'
        'Behavioral experiments convert abstract insight into tested learning by checking whether feared predictions actually come true.',
      ),
    ),
  ];
}

List<_WorkflowStepState> _workflowSteps(_StudioDocument? selectedDocument) {
  final stage = selectedDocument == null ? _WorkflowStage.source : _WorkflowStage.session;
  return [
    _WorkflowStepState(
      title: 'Sign in / enter prototype',
      subtitle: 'Authenticate the learner and restore progress.',
      status: stage.index > _WorkflowStage.welcome.index
          ? _WorkflowStatus.done
          : _WorkflowStatus.active,
    ),
    _WorkflowStepState(
      title: 'Add or choose material',
      subtitle: selectedDocument == null
          ? 'Upload or paste study material.'
          : 'Current source: ${selectedDocument.title}',
      status: selectedDocument == null ? _WorkflowStatus.active : _WorkflowStatus.done,
    ),
    const _WorkflowStepState(
      title: 'Choose today’s section',
      subtitle: 'Pick the exact chunk before reading starts.',
      status: _WorkflowStatus.upcoming,
    ),
    const _WorkflowStepState(
      title: 'Read with timer',
      subtitle: 'Track focused reading time in-app.',
      status: _WorkflowStatus.upcoming,
    ),
    const _WorkflowStepState(
      title: 'Recall from memory',
      subtitle: 'Hide the text, retell it, record the attempt.',
      status: _WorkflowStatus.upcoming,
    ),
    const _WorkflowStepState(
      title: 'Processing + scoring',
      subtitle: 'Transcription, comparison, score breakdown.',
      status: _WorkflowStatus.upcoming,
    ),
    const _WorkflowStepState(
      title: 'Feedback and note',
      subtitle: 'Retry or generate a corrected note and save it.',
      status: _WorkflowStatus.upcoming,
    ),
  ];
}

String _formatDuration(Duration duration) {
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

String _stageTitle(_WorkflowStage stage) {
  return switch (stage) {
    _WorkflowStage.welcome => 'Welcome',
    _WorkflowStage.source => 'Source intake',
    _WorkflowStage.session => 'Session setup',
    _WorkflowStage.reading => 'Reading mode',
    _WorkflowStage.recall => 'Recall mode',
    _WorkflowStage.processing => 'Processing',
    _WorkflowStage.feedback => 'Feedback',
    _WorkflowStage.note => 'Generated note',
  };
}

String _stem(String fileName) {
  final dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return fileName;
  }
  return fileName.substring(0, dotIndex);
}

String _decodeBytes(List<int> bytes) {
  try {
    return utf8.decode(bytes);
  } catch (_) {
    return latin1.decode(bytes);
  }
}

List<_StudioSection> _chunkIntoSections(String rawText) {
  final normalized = rawText.trim();
  if (normalized.isEmpty) {
    return const <_StudioSection>[];
  }
  final paragraphs = normalized
      .split(RegExp(r'\n\s*\n'))
      .map((segment) => segment.trim())
      .where((segment) => segment.isNotEmpty)
      .toList();
  final chunks = paragraphs.length >= 2
      ? paragraphs
      : normalized
            .split(RegExp(r'(?<=[.!?])\s+'))
            .map((segment) => segment.trim())
            .where((segment) => segment.isNotEmpty)
            .fold<List<String>>(<String>[], (accumulator, sentence) {
              if (accumulator.isEmpty || accumulator.last.length > 380) {
                accumulator.add(sentence);
              } else {
                accumulator[accumulator.length - 1] =
                    '${accumulator.last} $sentence'.trim();
              }
              return accumulator;
            });
  return chunks.asMap().entries.map((entry) {
    final content = entry.value;
    final words = content.split(RegExp(r'\s+')).where((word) => word.isNotEmpty).length;
    final estimatedReadMinutes = math.max(2, (words / 165).ceil());
    final difficulty = words >= 140
        ? 'advanced'
        : words >= 80
            ? 'standard'
            : 'beginner';
    final conceptCount = math.max(
      3,
      math.min(
        9,
        content.split(RegExp(r'(?<=[.!?])\s+')).where((line) => line.trim().isNotEmpty).length,
      ),
    );
    return _StudioSection(
      title: chunks.length == 1 ? 'Core section' : 'Section ${entry.key + 1}',
      content: content,
      estimatedReadMinutes: estimatedReadMinutes,
      difficulty: difficulty,
      conceptCount: conceptCount,
    );
  }).toList();
}

_EvaluationResult _evaluateRecall(String sourceText, String recallText) {
  final sourceTerms = _extractSignals(sourceText);
  final recallTerms = _extractSignals(recallText);
  final overlap = sourceTerms.where((term) => recallTerms.contains(term)).toList();
  final missing = sourceTerms.where((term) => !recallTerms.contains(term)).take(4).toList();
  final extras = recallTerms.where((term) => !sourceTerms.contains(term)).take(3).toList();
  final recallScore = ((overlap.length / math.max(1, sourceTerms.length)) * 100).round();
  final detailSignals = _extractDetailSignals(sourceText);
  final detailHits = detailSignals
      .where((signal) => recallText.toLowerCase().contains(signal.toLowerCase()))
      .length;
  final detailScore = ((detailHits / math.max(1, detailSignals.length)) * 100).round();
  final accuracyPenalty = math.min(35, extras.length * 11 + missing.take(2).length * 5);
  final accuracyScore = math.max(42, 96 - accuracyPenalty);
  final totalScore = math.max(
    0,
    math.min(
      100,
      (recallScore * 0.45 + accuracyScore * 0.35 + detailScore * 0.20).round(),
    ),
  );
  return _EvaluationResult(
    totalScore: totalScore,
    recallScore: recallScore.clamp(0, 100),
    accuracyScore: accuracyScore.clamp(0, 100),
    detailScore: detailScore.clamp(0, 100),
    summary: totalScore >= 70
        ? 'Good pass. The learner covered enough material to earn a corrected note, though missed concepts still matter.'
        : 'This attempt is below the recommended pass threshold. Retry is encouraged before relying on the note.',
    strengths: <String>[
      if (overlap.isNotEmpty)
        'You surfaced ${overlap.first}, which is one of the section’s core ideas.',
      if (detailHits >= 2)
        'You included concrete detail instead of only broad summary language.',
      if (recallText.split(RegExp(r'\s+')).length >= 45)
        'Your retelling had enough substance to score structure and specificity.',
    ],
    missingPieces: missing.isEmpty
        ? <String>['Coverage looked relatively complete for this prototype section.']
        : missing.map((item) => 'You did not clearly mention $item.').toList(),
    misconceptions: extras.isEmpty
        ? <String>['No major unsupported claims were detected in this prototype pass.']
        : extras
            .map((item) => 'You introduced $item without clear support from the source.')
            .toList(),
  );
}

List<String> _extractSignals(String text) {
  const stopWords = <String>{
    'about',
    'after',
    'again',
    'because',
    'could',
    'their',
    'there',
    'these',
    'those',
    'which',
    'would',
    'while',
    'where',
    'through',
    'under',
    'between',
    'being',
    'with',
    'that',
    'this',
    'from',
    'into',
    'have',
    'your',
  };
  final counts = <String, int>{};
  for (final token in text.toLowerCase().split(RegExp(r'[^a-z0-9]+'))) {
    if (token.length < 5 || stopWords.contains(token)) {
      continue;
    }
    counts[token] = (counts[token] ?? 0) + 1;
  }
  final ranked = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  return ranked.take(8).map((entry) => entry.key).toList();
}

List<String> _extractDetailSignals(String text) {
  return text
      .split(RegExp(r'[^A-Za-z0-9]+'))
      .where((token) => token.length >= 7)
      .map((token) => token.toLowerCase())
      .toSet()
      .take(10)
      .toList();
}

_GeneratedNote _buildNote(
  _StudioDocument document,
  _StudioSection section,
  String recall,
  _EvaluationResult evaluation,
) {
  return _GeneratedNote(
    id: 'generated-${DateTime.now().microsecondsSinceEpoch}',
    title: '${document.title} · ${section.title}',
    summary:
        'A corrected study note generated from the learner’s recall attempt and the original source material.',
    tags: <String>[
      document.subject,
      section.difficulty,
      if (evaluation.totalScore < 70) 'retry-worthy' else 'passed-recall',
    ],
    keyPoints: <String>[
      ..._sourceSentences(section.content).take(2),
      if (recall.trim().isNotEmpty) 'Learner phrasing kept where accurate: ${_trimSentence(recall)}',
    ],
    corrections: evaluation.missingPieces.take(3).toList(),
    reviewQuestions: <String>[
      'How would you explain ${section.title.toLowerCase()} again without looking?',
      'Which missing concept caused the biggest score drop?',
      'What definition or relationship would you tighten next time?',
    ],
    savedAt: DateTime.now(),
  );
}

Iterable<String> _sourceSentences(String text) sync* {
  for (final sentence in text
      .split(RegExp(r'(?<=[.!?])\s+'))
      .map((segment) => segment.trim())
      .where((segment) => segment.isNotEmpty)) {
    yield _trimSentence(sentence);
  }
}

String _trimSentence(String text) {
  final normalized = text.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (normalized.length <= 150) {
    return normalized;
  }
  return '${normalized.substring(0, 147).trim()}...';
}
