import 'package:collection/collection.dart';

import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockKnowledgeOrganizationService implements KnowledgeOrganizationService {
  const MockKnowledgeOrganizationService();

  static const Map<String, String> _folderByKeyword = {
    'photosynthesis': 'Biology Systems',
    'respiration': 'Biology Systems',
    'cell': 'Biology Systems',
    'revolution': 'History Context',
    'essay': 'Writing Studio',
    'memory': 'Learning Systems',
    'review': 'Learning Systems',
  };

  @override
  String get providerKey => 'mock-organizer';

  @override
  Future<KnowledgeOrganizationPlan> organize({
    required KnowledgeOrganizationContext context,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 650));

    final normalizedTokens = {
      ...context.generatedNote.tags,
      ...context.generatedNote.topics.map((topic) => topic.toLowerCase()),
      ...context.generatedNote.importantTerms.map((term) => term.toLowerCase()),
    };

    final mappedFolder = normalizedTokens
        .map((token) => _folderByKeyword[token])
        .firstWhereOrNull((folder) => folder != null);

    if (mappedFolder != null) {
      final existing = context.existingFolders.firstWhereOrNull(
        (folder) => folder.title.toLowerCase() == mappedFolder.toLowerCase(),
      );

      return KnowledgeOrganizationPlan(
        folderTitle: existing?.title ?? mappedFolder,
        folderDescription: existing?.description ??
            'AI-curated folder for notes around $mappedFolder.',
        createNewFolder: existing == null,
        tags: context.generatedNote.tags,
        topics: context.generatedNote.topics,
      );
    }

    return const KnowledgeOrganizationPlan(
      folderTitle: 'Quick Capture',
      folderDescription: 'Fresh voice notes that still need a second pass.',
      createNewFolder: false,
      tags: <String>[],
      topics: <String>[],
    );
  }
}
