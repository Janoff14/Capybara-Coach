import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/design_system/app_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 1000;
    final destinations = _destinationsForPlatform();
    final selectedIndex = _selectedIndex(destinations);

    return Scaffold(
      backgroundColor: AppColors.paper,
      bottomNavigationBar: isWide
          ? null
          : NavigationBar(
              selectedIndex: selectedIndex,
              onDestinationSelected: (index) {
                context.go(destinations[index].path);
              },
              destinations: [
                for (final destination in destinations)
                  NavigationDestination(
                    icon: Icon(destination.icon),
                    label: destination.label,
                  ),
              ],
            ),
      body: Stack(
        children: [
          const _DecorativeBackground(),
          SafeArea(
            child: isWide
                ? Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: _SideNavigation(
                          destinations: destinations,
                          selectedIndex: selectedIndex,
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(
                            top: AppSpacing.lg,
                            right: AppSpacing.lg,
                            bottom: AppSpacing.lg,
                          ),
                          child: child,
                        ),
                      ),
                    ],
                  )
                : Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      0,
                    ),
                    child: child,
                  ),
          ),
        ],
      ),
    );
  }

  List<_AppDestination> _destinationsForPlatform() {
    if (kIsWeb) {
      return const [
        _AppDestination(
          label: 'Review',
          path: '/library',
          icon: Icons.menu_book_outlined,
        ),
        _AppDestination(
          label: 'Settings',
          path: '/settings',
          icon: Icons.tune_outlined,
        ),
      ];
    }

    return const [
      _AppDestination(
        label: 'Capture',
        path: '/capture',
        icon: Icons.mic_none_rounded,
      ),
      _AppDestination(
        label: 'Review',
        path: '/library',
        icon: Icons.menu_book_outlined,
      ),
      _AppDestination(
        label: 'Settings',
        path: '/settings',
        icon: Icons.tune_outlined,
      ),
    ];
  }

  int _selectedIndex(List<_AppDestination> destinations) {
    final targetPath = switch (location) {
      final value when value.startsWith('/dashboard') => '/capture',
      final value when value.startsWith('/session') => '/capture',
      final value
          when value.startsWith('/notes') || value.startsWith('/folders') =>
        '/library',
      _ => location,
    };

    final index = destinations.indexWhere((item) => item.path == targetPath);
    return index == -1 ? 0 : index;
  }
}

class _AppDestination {
  const _AppDestination({
    required this.label,
    required this.path,
    required this.icon,
  });

  final String label;
  final String path;
  final IconData icon;
}

class _SideNavigation extends StatelessWidget {
  const _SideNavigation({
    required this.destinations,
    required this.selectedIndex,
  });

  final List<_AppDestination> destinations;
  final int selectedIndex;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 112,
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(32),
      ),
      child: NavigationRail(
        backgroundColor: Colors.transparent,
        extended: false,
        minWidth: 96,
        destinations: [
          for (final destination in destinations)
            NavigationRailDestination(
              icon: Icon(destination.icon),
              label: Text(destination.label),
            ),
        ],
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          context.go(destinations[index].path);
        },
      ),
    );
  }
}

class _DecorativeBackground extends StatelessWidget {
  const _DecorativeBackground();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          top: -80,
          right: -40,
          child: _Blob(
            color: AppColors.mint.withValues(alpha: 0.18),
            size: 220,
          ),
        ),
        Positioned(
          top: 120,
          left: -60,
          child: _Blob(
            color: AppColors.ocean.withValues(alpha: 0.12),
            size: 180,
          ),
        ),
        Positioned(
          bottom: -70,
          right: 120,
          child: _Blob(
            color: AppColors.coral.withValues(alpha: 0.12),
            size: 210,
          ),
        ),
      ],
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
