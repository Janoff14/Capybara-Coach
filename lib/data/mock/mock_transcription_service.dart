import '../../domain/models/app_user.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockTranscriptionService implements TranscriptionService {
  const MockTranscriptionService();

  static const List<String> _sampleTranscripts = [
    'Today I want to remember that photosynthesis stores sunlight as chemical energy. The light reactions make ATP and NADPH, then the Calvin cycle uses those to build glucose from carbon dioxide.',
    'I need a study note about the French Revolution. The main causes were social inequality, debt, food shortages, and Enlightenment ideas that challenged the old monarchy.',
    'Here is a note about how spaced repetition works. The core idea is to review information right before forgetting, because that strengthens memory more efficiently than rereading everything at once.',
    'I am summarizing cellular respiration. Glucose gets broken down through glycolysis, the Krebs cycle, and the electron transport chain so the cell can make ATP.',
    'This voice note is about writing stronger essays. Start with a claim, support it with evidence, explain the evidence, and tie the paragraph back to the main argument.',
  ];

  @override
  String get providerKey => 'mock-transcriber';

  @override
  Future<TranscriptResult> transcribe({
    required AppUser user,
    required StoredAudioAsset audio,
    required Duration duration,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    final index = duration.inSeconds % _sampleTranscripts.length;
    final transcript = _sampleTranscripts[index];

    return TranscriptResult(
      text: transcript,
      languageCode: 'en',
      providerKey: providerKey,
    );
  }
}
