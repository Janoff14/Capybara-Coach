import '../../domain/models/app_user.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';

class MockSeedData {
  static List<FolderEntity> folders(AppUser user) {
    final now = DateTime.now();

    return [
      FolderEntity(
        id: 'folder-inbox',
        userId: user.id,
        title: 'Quick Capture',
        description: 'Fresh voice notes that still need a second pass.',
        parentFolderId: null,
        createdAt: now.subtract(const Duration(days: 21)),
        updatedAt: now.subtract(const Duration(hours: 8)),
        aiGenerated: false,
      ),
      FolderEntity(
        id: 'folder-biology',
        userId: user.id,
        title: 'Biology Systems',
        description: 'Processes, structures, and relationships worth revisiting.',
        parentFolderId: null,
        createdAt: now.subtract(const Duration(days: 16)),
        updatedAt: now.subtract(const Duration(days: 1)),
        aiGenerated: true,
      ),
      FolderEntity(
        id: 'folder-history',
        userId: user.id,
        title: 'History Context',
        description: 'Cause-and-effect notes with timelines and people.',
        parentFolderId: null,
        createdAt: now.subtract(const Duration(days: 11)),
        updatedAt: now.subtract(const Duration(days: 3)),
        aiGenerated: true,
      ),
    ];
  }

  static List<StudyNote> notes(AppUser user) {
    final now = DateTime.now();

    return [
      StudyNote(
        id: 'note-photosynthesis',
        userId: user.id,
        folderId: 'folder-biology',
        sourceAudioUrl: 'mock://audio/photosynthesis.m4a',
        rawTranscript:
            'Photosynthesis turns light energy into chemical energy. The chloroplast uses carbon dioxide and water to build glucose and oxygen.',
        cleanedTitle: 'Photosynthesis as an energy conversion system',
        cleanedSummary:
            'Photosynthesis captures sunlight, stores it in glucose, and releases oxygen as a by-product.',
        cleanedContent:
            'Photosynthesis is the process plants use to convert light energy into chemical energy.\n\nIt happens in chloroplasts, where light-dependent reactions capture energy and the Calvin cycle uses that energy to build glucose from carbon dioxide.\n\nRemember the big picture: sunlight becomes stored fuel, and oxygen is released.',
        keyIdeas: const [
          'Chloroplasts are the main site of photosynthesis.',
          'Light reactions make ATP and NADPH.',
          'The Calvin cycle uses those molecules to build glucose.',
        ],
        reviewQuestions: const [
          'Why are light reactions necessary before the Calvin cycle?',
          'How would you explain the role of chlorophyll to a classmate?',
        ],
        keyTerms: const ['chloroplast', 'ATP', 'Calvin cycle', 'glucose'],
        tags: const ['biology', 'energy', 'plants'],
        topics: const ['photosynthesis', 'cell processes'],
        relatedNoteIds: const ['note-cellular-respiration'],
        aiProcessingStatus: NoteProcessingStatus.ready,
        createdAt: now.subtract(const Duration(days: 4)),
        updatedAt: now.subtract(const Duration(days: 2)),
        sourceDuration: const Duration(minutes: 1, seconds: 18),
      ),
      StudyNote(
        id: 'note-cellular-respiration',
        userId: user.id,
        folderId: 'folder-biology',
        sourceAudioUrl: 'mock://audio/respiration.m4a',
        rawTranscript:
            'Cellular respiration breaks down glucose to release ATP. It connects to photosynthesis because glucose and oxygen feed the process.',
        cleanedTitle: 'Cellular respiration and ATP production',
        cleanedSummary:
            'Cellular respiration releases the energy stored in glucose so cells can produce ATP.',
        cleanedContent:
            'Cellular respiration is the process cells use to break down glucose and release usable energy.\n\nIt moves through glycolysis, the Krebs cycle, and the electron transport chain.\n\nLink it with photosynthesis: one stores energy, the other releases it.',
        keyIdeas: const [
          'ATP is the cell energy currency.',
          'Glycolysis starts glucose breakdown.',
          'The electron transport chain creates most ATP.',
        ],
        reviewQuestions: const [
          'How do photosynthesis and respiration depend on each other?',
          'Where does most ATP come from during respiration?',
        ],
        keyTerms: const ['ATP', 'glycolysis', 'mitochondria'],
        tags: const ['biology', 'energy', 'cells'],
        topics: const ['cellular respiration', 'metabolism'],
        relatedNoteIds: const ['note-photosynthesis'],
        aiProcessingStatus: NoteProcessingStatus.ready,
        createdAt: now.subtract(const Duration(days: 3)),
        updatedAt: now.subtract(const Duration(days: 1, hours: 4)),
        sourceDuration: const Duration(minutes: 1, seconds: 6),
      ),
      StudyNote(
        id: 'note-french-revolution',
        userId: user.id,
        folderId: 'folder-history',
        sourceAudioUrl: 'mock://audio/french-revolution.m4a',
        rawTranscript:
            'The French Revolution began because social inequality, financial crisis, and Enlightenment ideas pushed people to challenge the monarchy.',
        cleanedTitle: 'French Revolution causes at a glance',
        cleanedSummary:
            'The Revolution emerged from inequality, debt, food pressure, and new political ideas.',
        cleanedContent:
            'The French Revolution did not start from one single spark.\n\nEconomic strain, inequality between estates, and Enlightenment thinking all combined to make the old system unstable.\n\nWhen reviewing, connect causes to the political changes that followed.',
        keyIdeas: const [
          'Inequality between estates created long-term resentment.',
          'Financial crisis weakened the monarchy.',
          'Enlightenment ideas made change feel possible.',
        ],
        reviewQuestions: const [
          'Which cause was most immediate and which was more structural?',
          'How did ideas and economics reinforce each other?',
        ],
        keyTerms: const ['Estates-General', 'Enlightenment', 'monarchy'],
        tags: const ['history', 'revolution', 'cause and effect'],
        topics: const ['French Revolution'],
        relatedNoteIds: const [],
        aiProcessingStatus: NoteProcessingStatus.ready,
        createdAt: now.subtract(const Duration(days: 7)),
        updatedAt: now.subtract(const Duration(days: 3)),
        sourceDuration: const Duration(minutes: 1, seconds: 40),
      ),
    ];
  }
}
