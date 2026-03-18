import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const Color ink = Color(0xFF15233A);
  static const Color ocean = Color(0xFF2E6EE8);
  static const Color mint = Color(0xFF67D7C4);
  static const Color coral = Color(0xFFF38A7B);
  static const Color sun = Color(0xFFF7D46B);
  static const Color paper = Color(0xFFF6F7FB);
  static const Color card = Color(0xFFFFFFFF);
  static const Color success = Color(0xFF2F9D75);
  static const Color warning = Color(0xFFCA8A04);
  static const Color danger = Color(0xFFCC4D52);
}

class AppSpacing {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
}

class AppTheme {
  static ThemeData build() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.ocean,
        brightness: Brightness.light,
        surface: AppColors.paper,
      ),
    );

    final textTheme = GoogleFonts.spaceGroteskTextTheme(base.textTheme).copyWith(
      bodyLarge: GoogleFonts.plusJakartaSans(
        textStyle: base.textTheme.bodyLarge,
        color: AppColors.ink,
        height: 1.45,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        textStyle: base.textTheme.bodyMedium,
        color: AppColors.ink,
        height: 1.4,
      ),
      titleMedium: GoogleFonts.plusJakartaSans(
        textStyle: base.textTheme.titleMedium,
        fontWeight: FontWeight.w700,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.paper,
      textTheme: textTheme,
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.card.withValues(alpha: 0.94),
        indicatorColor: AppColors.ocean.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.all(
          textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        side: BorderSide.none,
        backgroundColor: AppColors.ink.withValues(alpha: 0.06),
        labelStyle: textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: AppColors.ink.withValues(alpha: 0.48),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(
            color: AppColors.ink.withValues(alpha: 0.08),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(
            color: AppColors.ocean,
            width: 1.4,
          ),
        ),
      ),
    );
  }
}
