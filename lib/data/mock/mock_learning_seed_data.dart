import '../../domain/models/app_user.dart';
import '../../domain/models/learning_source.dart';

class MockLearningSeedData {
  static List<LearningSource> sources(AppUser user) {
    final now = DateTime.now();

    return [
      LearningSource(
        id: 'source-networking',
        userId: user.id,
        title: 'Networking Basics',
        subtitle: 'Packet switching, TCP/IP, and common misconceptions',
        type: LearningSourceType.pdf,
        sections: const [
          LearningSection(
            id: 'networking-1',
            title: 'Chapter 1: Why packets beat circuits',
            pageLabel: 'Pages 1-6',
            order: 1,
            extractedText:
                'Packet switching sends data in small units that can travel independently through a network. This makes networks more efficient than dedicated circuit paths when traffic is bursty. Routers inspect packet headers, forward traffic toward the destination, and share capacity across many users. A common misunderstanding is that packet switching guarantees equal delay. It does not. Delay changes with congestion, queue length, and route selection.',
            estimatedReadMinutes: 4,
            difficulty: LearningDifficulty.beginner,
            conceptCount: 4,
          ),
          LearningSection(
            id: 'networking-2',
            title: 'Chapter 2: TCP reliability in practice',
            pageLabel: 'Pages 7-12',
            order: 2,
            extractedText:
                'TCP provides reliability by numbering bytes, acknowledging received data, retransmitting losses, and adjusting sending rate with flow and congestion control. Reliable delivery does not mean instant delivery. TCP may delay packets to preserve order or recover from loss. A frequent edge case is head-of-line blocking: one missing segment can hold later data until recovery completes.',
            estimatedReadMinutes: 5,
            difficulty: LearningDifficulty.standard,
            conceptCount: 5,
          ),
        ],
        createdAt: now.subtract(const Duration(days: 6)),
        updatedAt: now.subtract(const Duration(hours: 8)),
      ),
      LearningSource(
        id: 'source-biology',
        userId: user.id,
        title: 'Biology Ch 3',
        subtitle: 'Cell energy systems and linked processes',
        type: LearningSourceType.pdf,
        sections: const [
          LearningSection(
            id: 'biology-1',
            title: 'Pages 18-24: Photosynthesis',
            pageLabel: 'Pages 18-24',
            order: 1,
            extractedText:
                'Photosynthesis stores light energy as chemical energy. Light-dependent reactions generate ATP and NADPH, then the Calvin cycle uses those molecules to build glucose from carbon dioxide. Chloroplasts are the main site of the process. Students often remember oxygen release but forget that glucose formation is the central storage outcome.',
            estimatedReadMinutes: 4,
            difficulty: LearningDifficulty.standard,
            conceptCount: 4,
          ),
          LearningSection(
            id: 'biology-2',
            title: 'Pages 25-30: Cellular respiration',
            pageLabel: 'Pages 25-30',
            order: 2,
            extractedText:
                'Cellular respiration breaks down glucose to release usable energy in the form of ATP. Glycolysis starts the process, the Krebs cycle continues energy extraction, and the electron transport chain generates most ATP. One useful connection is that photosynthesis stores energy while respiration releases it.',
            estimatedReadMinutes: 4,
            difficulty: LearningDifficulty.standard,
            conceptCount: 4,
          ),
        ],
        createdAt: now.subtract(const Duration(days: 3)),
        updatedAt: now.subtract(const Duration(hours: 3)),
      ),
    ];
  }
}
