import '../../domain/models/learning_session.dart';
import '../../domain/services/pipeline_services.dart';

class MockRecallEvaluationService implements RecallEvaluationService {
  const MockRecallEvaluationService();

  static const int _threshold = 70;
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
    'because',
    'while',
    'where',
    'there',
    'their',
    'would',
    'could',
    'should',
    'have',
    'has',
  };

  @override
  String get providerKey => 'mock-evaluator';

  @override
  Future<SessionFeedback> evaluate({
    required LearningSession session,
    required String recallTranscript,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    final sourceTerms = _extractSignals(session.sourceText);
    final recallTerms = _extractSignals(recallTranscript);
    final overlap = sourceTerms.where(recallTerms.contains).toList();
    final missing = sourceTerms.where((term) => !recallTerms.contains(term)).toList();
    final introduced = recallTerms.where((term) => !sourceTerms.contains(term)).toList();

    final recallScore =
        ((overlap.length / sourceTerms.length.clamp(1, 999)) * 100).round();
    final detailSignals = _extractDetailSignals(session.sourceText);
    final recalledDetails = detailSignals.where(
      (detail) => recallTranscript.toLowerCase().contains(detail.toLowerCase()),
    );
    final detailScore =
        ((recalledDetails.length / detailSignals.length.clamp(1, 999)) * 100).round();
    final accuracyPenalty = (introduced.length * 9).clamp(0, 35);
    final accuracyScore = (92 - accuracyPenalty).clamp(45, 95);
    final totalScore = ((recallScore * 0.45) +
            (accuracyScore * 0.35) +
            (detailScore * 0.20))
        .round()
        .clamp(0, 100);

    return SessionFeedback(
      breakdown: SessionScoreBreakdown(
        totalScore: totalScore,
        recallScore: recallScore.clamp(0, 100),
        accuracyScore: accuracyScore,
        detailScore: detailScore.clamp(0, 100),
        missingConceptCount: missing.take(4).length,
        misconceptionCount: introduced.take(3).length,
      ),
      strengths: [
        if (overlap.isNotEmpty) 'You clearly retained ${overlap.first}.',
        if (recalledDetails.isNotEmpty)
          'You included useful specifics instead of only broad summary.',
        if (overlap.length >= sourceTerms.length / 2)
          'Your retelling covered more than half of the core concepts.',
      ],
      specificFeedback: [
        if (totalScore >= _threshold)
          'Good pass. Your explanation is usable, but tighten the missing concepts before reviewing later.'
        else
          'You are close, but the recall is still missing too much of the source to lock it in.',
        if (detailScore < 55)
          'You need more specifics such as examples, edge cases, names, or process steps.'
        else
          'Your level of detail is solid for a first recall attempt.',
      ],
      missingPieces: [
        for (final item in missing.take(4))
          'You did not mention $item.',
      ],
      misconceptions: [
        for (final item in introduced.take(3))
          'You introduced $item without support from the reading.',
      ],
      thresholdScore: _threshold,
    );
  }

  List<String> _extractSignals(String text) {
    final counts = <String, int>{};
    for (final token in text
        .toLowerCase()
        .split(RegExp(r'[^a-z0-9]+'))
        .where((word) => word.length > 4 && !_stopWords.contains(word))) {
      counts.update(token, (value) => value + 1, ifAbsent: () => 1);
    }
    final ranked = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return ranked.take(8).map((entry) => entry.key).toList();
  }

  List<String> _extractDetailSignals(String text) {
    final sentences = text
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    return sentences.take(4).toList();
  }
}
