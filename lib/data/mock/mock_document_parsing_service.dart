import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/services/pipeline_services.dart';

class MockDocumentParsingService implements DocumentParsingService {
  const MockDocumentParsingService();

  @override
  String get providerKey => 'mock-parser';

  @override
  Future<LearningSource> importSource({
    required AppUser user,
    required LearningSourceType sourceType,
    required String title,
    required String subtitle,
    String? rawText,
    String? fileName,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));

    final sourceId = const Uuid().v4();
    final sections = _buildSections(title: title, rawText: rawText, fileName: fileName);

    return LearningSource(
      id: sourceId,
      userId: user.id,
      title: title,
      subtitle: subtitle,
      type: sourceType,
      sections: sections,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  List<LearningSection> _buildSections({
    required String title,
    String? rawText,
    String? fileName,
  }) {
    final text = (rawText == null || rawText.trim().isEmpty)
        ? _placeholderTextFor(title, fileName)
        : rawText.trim();
    final chunks = _chunkText(text);

    return [
      for (var index = 0; index < chunks.length; index++)
        LearningSection(
          id: '${title.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-')}-${index + 1}',
          title: chunks.length == 1
              ? 'Core section'
              : 'Section ${index + 1}',
          pageLabel: chunks.length == 1
              ? 'Selected text'
              : 'Part ${index + 1} of ${chunks.length}',
          order: index,
          extractedText: chunks[index],
          estimatedReadMinutes: _estimateReadMinutes(chunks[index]),
          difficulty: _estimateDifficulty(chunks[index]),
          conceptCount: _estimateConcepts(chunks[index]),
        ),
    ];
  }

  List<String> _chunkText(String text) {
    final paragraphs = text
        .split(RegExp(r'\n\s*\n'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();

    if (paragraphs.length >= 2) {
      return paragraphs.take(4).toList();
    }

    final sentences = text
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();

    if (sentences.length <= 4) {
      return [text];
    }

    final chunks = <String>[];
    for (var i = 0; i < sentences.length; i += 4) {
      chunks.add(sentences.skip(i).take(4).join(' '));
    }
    return chunks;
  }

  int _estimateConcepts(String text) {
    return (text.split(RegExp(r'(?<=[.!?])\s+')).length).clamp(3, 8);
  }

  LearningDifficulty _estimateDifficulty(String text) {
    final words = text.split(RegExp(r'\s+')).length;
    if (words < 90) {
      return LearningDifficulty.beginner;
    }
    if (words < 180) {
      return LearningDifficulty.standard;
    }
    return LearningDifficulty.advanced;
  }

  int _estimateReadMinutes(String text) {
    final words = text.split(RegExp(r'\s+')).where((word) => word.isNotEmpty).length;
    return ((words / 170).ceil()).clamp(3, 12);
  }

  String _placeholderTextFor(String title, String? fileName) {
    final seed = (fileName ?? title).toLowerCase();

    if (seed.contains('network')) {
      return 'Packet switching breaks data into small units that can travel across shared infrastructure. Routers inspect headers and forward packets toward a destination. Because links are shared, networks remain efficient when demand is bursty. A common misconception is that packet switching guarantees identical delay for all traffic. In practice, queueing and congestion change delivery times.\n\nTCP adds reliability on top of IP by sequencing bytes, acknowledging delivery, retransmitting lost data, and managing flow. Reliability does not guarantee low latency. In fact, retransmission and ordered delivery can delay useful data when one segment is missing.';
    }

    if (seed.contains('bio') || seed.contains('cell')) {
      return 'Photosynthesis stores light energy as chemical energy. Light reactions generate ATP and NADPH, then the Calvin cycle uses them to build glucose from carbon dioxide. Chloroplasts host this process, and oxygen release is a by-product rather than the main storage goal.\n\nCellular respiration releases stored energy from glucose so cells can create ATP. Glycolysis begins the breakdown, the Krebs cycle extracts more energy, and the electron transport chain generates most ATP. Together, photosynthesis and respiration form a useful conceptual pair: one stores energy, the other releases it.';
    }

    return 'Start with the central claim, then explain the mechanism, edge cases, examples, and common misunderstandings. Strong learning material works best when it can be broken into a few core concepts that later become recall prompts. When a user retells the content, the goal is not perfect memorization of every sentence but accurate explanation of the essential ideas and any crucial exceptions.';
  }
}
