enum LearningSourceType {
  pdf,
  text,
  voiceNote,
  link;

  String get label => switch (this) {
        LearningSourceType.pdf => 'PDF',
        LearningSourceType.text => 'Text',
        LearningSourceType.voiceNote => 'Voice note',
        LearningSourceType.link => 'Link',
      };
}

enum LearningDifficulty {
  beginner,
  standard,
  advanced;

  String get label => switch (this) {
        LearningDifficulty.beginner => 'Beginner',
        LearningDifficulty.standard => 'Standard',
        LearningDifficulty.advanced => 'Advanced',
      };
}

class LearningSection {
  const LearningSection({
    required this.id,
    required this.title,
    required this.pageLabel,
    required this.order,
    required this.extractedText,
    required this.estimatedReadMinutes,
    required this.difficulty,
    required this.conceptCount,
  });

  final String id;
  final String title;
  final String pageLabel;
  final int order;
  final String extractedText;
  final int estimatedReadMinutes;
  final LearningDifficulty difficulty;
  final int conceptCount;
}

class LearningSource {
  const LearningSource({
    required this.id,
    required this.userId,
    required this.title,
    required this.subtitle,
    required this.type,
    required this.sections,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String title;
  final String subtitle;
  final LearningSourceType type;
  final List<LearningSection> sections;
  final DateTime createdAt;
  final DateTime updatedAt;

  LearningSource copyWith({
    String? id,
    String? userId,
    String? title,
    String? subtitle,
    LearningSourceType? type,
    List<LearningSection>? sections,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return LearningSource(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      type: type ?? this.type,
      sections: sections ?? this.sections,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
