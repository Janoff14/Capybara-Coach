import '../../domain/models/learning_session.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockSessionNoteSynthesisService implements SessionNoteSynthesisService {
  const MockSessionNoteSynthesisService();

  @override
  String get providerKey => 'mock-note-synthesizer';

  @override
  Future<GeneratedStudyNote> synthesize({
    required LearningSession session,
    required SessionFeedback feedback,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    final sourceSentences = session.sourceText
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final recall = session.recallTranscript ?? '';
    final strengths = feedback.strengths.take(2).toList();
    final corrections = feedback.missingPieces.take(3).toList();
    final concepts = _extractTerms(session.sourceText);

    final content = StringBuffer()
      ..writeln('What you proved you understood')
      ..writeAll(strengths.map((item) => '- $item'), '\n')
      ..writeln()
      ..writeln()
      ..writeln('Memory correction layer')
      ..writeAll(corrections.map((item) => '- $item'), '\n')
      ..writeln()
      ..writeln()
      ..writeln('Refined study note')
      ..writeln(
        'Your own explanation matters, so this note blends the reading with your recall attempt instead of replacing it with raw source text.',
      )
      ..writeln()
      ..writeln(
        recall.isEmpty ? sourceSentences.take(2).join(' ') : recall,
      )
      ..writeln()
      ..writeln(sourceSentences.skip(1).take(2).join(' '));

    return GeneratedStudyNote(
      title: '${session.sectionTitle} review note',
      summary:
          'A corrected study note built from your recall attempt plus the source text you missed.',
      cleanedContent: content.toString().trim(),
      keyIdeas: [
        ...sourceSentences.take(3).map((item) => item.replaceAll(RegExp(r'[.!?]+$'), '')),
      ],
      importantTerms: concepts.take(6).toList(),
      reviewQuestions: [
        'How would you re-explain ${session.sectionTitle} without seeing the text?',
        'Which missing concept caused the biggest drop in your score?',
      ],
      tags: concepts.take(4).map((term) => term.toLowerCase().replaceAll(' ', '-')).toList(),
      topics: concepts.take(3).toList(),
    );
  }

  List<String> _extractTerms(String text) {
    final words = text
        .split(RegExp(r'[^A-Za-z0-9]+'))
        .where((word) => word.length > 4)
        .map((word) => '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}')
        .toSet()
        .toList();
    return words;
  }
}
