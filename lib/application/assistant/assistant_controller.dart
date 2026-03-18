import 'dart:async';

import 'package:flutter_riverpod/legacy.dart';

import '../../domain/models/assistant_mood.dart';

class AssistantController extends StateNotifier<AssistantMood> {
  AssistantController() : super(AssistantMood.idle);

  Timer? _resetTimer;

  void setMood(AssistantMood mood) {
    _resetTimer?.cancel();
    state = mood;
  }

  void reactToTap() {
    state = switch (state) {
      AssistantMood.idle => AssistantMood.happy,
      AssistantMood.happy => AssistantMood.thinking,
      AssistantMood.thinking => AssistantMood.listening,
      AssistantMood.listening => AssistantMood.idle,
      AssistantMood.confused => AssistantMood.idle,
    };

    _scheduleIdleReset();
  }

  Future<void> celebrateSave() async {
    setMood(AssistantMood.happy);
    _scheduleIdleReset();
  }

  void signalError() {
    setMood(AssistantMood.confused);
    _scheduleIdleReset();
  }

  void _scheduleIdleReset() {
    _resetTimer?.cancel();
    _resetTimer = Timer(const Duration(seconds: 3), () {
      state = AssistantMood.idle;
    });
  }

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }
}
