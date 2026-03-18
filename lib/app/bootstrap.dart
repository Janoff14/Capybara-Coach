import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/bootstrap/app_bootstrapper.dart';
import 'app.dart';
import 'providers.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final dependencies = await const AppBootstrapper().create();

  runApp(
    ProviderScope(
      overrides: createDependencyOverrides(dependencies),
      child: const DictaCoachApp(),
    ),
  );
}
