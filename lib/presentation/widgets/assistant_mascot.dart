import 'package:flutter/material.dart';

import '../../core/design_system/app_theme.dart';
import '../../domain/models/assistant_mood.dart';

class AssistantMascot extends StatelessWidget {
  const AssistantMascot({
    super.key,
    required this.mood,
    required this.onTap,
  });

  final AssistantMood mood;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 240),
            child: Container(
              key: ValueKey<AssistantMood>(mood),
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.card.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.ink.withValues(alpha: 0.08),
                    blurRadius: 22,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: Text(
                _labelForMood(mood),
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ),
          AnimatedScale(
            scale: mood == AssistantMood.happy ? 1.06 : 1,
            duration: const Duration(milliseconds: 260),
            child: AnimatedRotation(
              turns: mood == AssistantMood.confused ? -0.03 : 0,
              duration: const Duration(milliseconds: 260),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 260),
                width: 74,
                height: 74,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: switch (mood) {
                      AssistantMood.idle => const [AppColors.ocean, AppColors.mint],
                      AssistantMood.listening => const [AppColors.mint, AppColors.sun],
                      AssistantMood.thinking => const [AppColors.sun, AppColors.coral],
                      AssistantMood.happy => const [AppColors.coral, AppColors.sun],
                      AssistantMood.confused => const [AppColors.coral, AppColors.danger],
                    },
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.ocean.withValues(alpha: 0.2),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned(
                      top: 24,
                      left: 22,
                      child: _Eye(mood: mood),
                    ),
                    Positioned(
                      top: 24,
                      right: 22,
                      child: _Eye(mood: mood),
                    ),
                    Positioned(
                      bottom: 20,
                      child: _Mouth(mood: mood),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _labelForMood(AssistantMood mood) {
    return switch (mood) {
      AssistantMood.idle => 'Tap me for a boost',
      AssistantMood.listening => 'I am listening',
      AssistantMood.thinking => 'Shaping the note',
      AssistantMood.happy => 'Nice one',
      AssistantMood.confused => 'Something feels off',
    };
  }
}

class _Eye extends StatelessWidget {
  const _Eye({required this.mood});

  final AssistantMood mood;

  @override
  Widget build(BuildContext context) {
    final height = mood == AssistantMood.thinking ? 4.0 : 8.0;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      width: 8,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(8),
      ),
    );
  }
}

class _Mouth extends StatelessWidget {
  const _Mouth({required this.mood});

  final AssistantMood mood;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      width: mood == AssistantMood.confused ? 18 : 24,
      height: mood == AssistantMood.happy ? 10 : 6,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: AppColors.ink.withValues(alpha: 0.9),
      ),
    );
  }
}
