import 'dart:math';

import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockRelatedNotesService implements RelatedNotesService {
  const MockRelatedNotesService();

  @override
  String get providerKey => 'mock-similarity';

  @override
  Future<List<RelatedNoteMatch>> findRelated({
    required RelatedNotesContext context,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    final currentSignals = {
      ...context.currentNote.tags.map((tag) => tag.toLowerCase()),
      ...context.currentNote.topics.map((topic) => topic.toLowerCase()),
      ...context.currentNote.keyTerms.map((term) => term.toLowerCase()),
    };

    final matches = <RelatedNoteMatch>[];

    for (final candidate in context.existingNotes) {
      final candidateSignals = {
        ...candidate.tags.map((tag) => tag.toLowerCase()),
        ...candidate.topics.map((topic) => topic.toLowerCase()),
        ...candidate.keyTerms.map((term) => term.toLowerCase()),
      };

      final overlap = currentSignals.intersection(candidateSignals).length;
      final denominator = max(currentSignals.length, candidateSignals.length);
      final score = denominator == 0 ? 0 : overlap / denominator;

      if (score >= 0.24) {
        matches.add(
          RelatedNoteMatch(
            noteId: candidate.id,
            relationType: overlap >= 2 ? 'shared topic' : 'adjacent idea',
            score: double.parse(score.toStringAsFixed(2)),
          ),
        );
      }
    }

    matches.sort((a, b) => b.score.compareTo(a.score));
    return matches.take(4).toList();
  }
}
