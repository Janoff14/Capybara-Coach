enum AssistantMood {
  idle,
  listening,
  thinking,
  happy,
  confused;

  String get label => switch (this) {
        AssistantMood.idle => 'Idle',
        AssistantMood.listening => 'Listening',
        AssistantMood.thinking => 'Thinking',
        AssistantMood.happy => 'Happy',
        AssistantMood.confused => 'Confused',
      };
}
