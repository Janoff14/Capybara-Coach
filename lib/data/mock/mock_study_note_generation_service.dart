import 'dart:math';

import 'package:collection/collection.dart';

import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockStudyNoteGenerationService implements StudyNoteGenerationService {
  const MockStudyNoteGenerationService();

  static const Set<String> _stopWords = {
    'the',
    'and',
    'that',
    'with',
    'this',
    'from',
    'into',
    'your',
    'about',
    'then',
    'they',
    'them',
    'need',
    'because',
    'more',
    'than',
    'once',
    'just',
    'when',
    'before',
    'after',
    'here',
    'want',
    'will',
    'also',
    'make',
    'makes',
    'where',
  };

  @override
  String get providerKey => 'mock-llm';

  @override
  Future<GeneratedStudyNote> generate({
    required NoteGenerationContext context,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 1100));

    final transcript = context.transcript.text.trim();
    final sentences = transcript
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((sentence) => sentence.trim())
        .where((sentence) => sentence.isNotEmpty)
        .toList();

    final title = _buildTitle(sentences, transcript);
    final summary = sentences.take(2).join(' ');
    final keyIdeas = [
      for (final sentence in sentences.take(4)) _trimSentence(sentence),
    ];
    final importantTerms = _extractImportantTerms(transcript);
    final topics = importantTerms.take(min(3, importantTerms.length)).toList();
    final tags = importantTerms
        .take(min(5, importantTerms.length))
        .map((term) => term.toLowerCase().replaceAll(' ', '-'))
        .toList();
    final reviewQuestions = _buildReviewQuestions(title, topics);

    final buffer = StringBuffer()
      ..writeln('Overview')
      ..writeln(summary)
      ..writeln()
      ..writeln('Key ideas')
      ..writeAll(
        keyIdeas.map((idea) => '- $idea'),
        '\n',
      )
      ..writeln()
      ..writeln()
      ..writeln('Study angle')
      ..writeln(
        'Focus on how the main idea connects to supporting steps, definitions, or causes. This makes the note easier to review later.',
      );

    return GeneratedStudyNote(
      title: title,
      summary: summary,
      cleanedContent: buffer.toString().trim(),
      keyIdeas: keyIdeas,
      importantTerms: importantTerms,
      reviewQuestions: reviewQuestions,
      tags: tags,
      topics: topics,
    );
  }

  String _buildTitle(List<String> sentences, String transcript) {
    final firstSentence = sentences.firstOrNull ?? transcript;
    final cleaned = _trimSentence(firstSentence);
    if (cleaned.length <= 64) {
      return cleaned;
    }

    return '${cleaned.substring(0, 61).trim()}...';
  }

  List<String> _buildReviewQuestions(String title, List<String> topics) {
    final primaryTopic = topics.firstOrNull ?? title;
    return [
      'How would you explain $primaryTopic in your own words?',
      'Which supporting detail best strengthens this note, and why?',
    ];
  }

  List<String> _extractImportantTerms(String transcript) {
    final frequencies = <String, int>{};

    for (final rawWord in transcript
        .toLowerCase()
        .split(RegExp(r'[^a-z0-9]+'))
        .where((word) => word.length > 3 && !_stopWords.contains(word))) {
      frequencies.update(rawWord, (value) => value + 1, ifAbsent: () => 1);
    }

    final sorted = frequencies.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(6).map((entry) => _titleCase(entry.key)).toList();
  }

  String _titleCase(String value) {
    return value
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String _trimSentence(String sentence) {
    return sentence.replaceAll(RegExp(r'\s+'), ' ').replaceAll(RegExp(r'[.!?]+$'), '');
  }
}
