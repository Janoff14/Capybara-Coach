import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/design_system/app_theme.dart';
import 'providers.dart';

class DictaCoachApp extends ConsumerWidget {
  const DictaCoachApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final environment = ref.watch(environmentProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: environment.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      routerConfig: router,
    );
  }
}
