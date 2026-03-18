import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class AppEnvironment {
  const AppEnvironment({
    required this.appName,
    required this.appFlavor,
    required this.useFirebase,
    required this.pipelineMode,
    required this.apiBaseUrl,
    required this.apiPollIntervalSeconds,
    required this.apiReadyTimeoutSeconds,
    required this.demoUserId,
    required this.demoUserEmail,
    required this.demoUserName,
    required this.transcriptionProvider,
    required this.llmProvider,
    required this.embeddingsProvider,
    required this.firebaseApiKey,
    required this.firebaseAuthDomain,
    required this.firebaseProjectId,
    required this.firebaseStorageBucket,
    required this.firebaseMessagingSenderId,
    required this.firebaseAndroidAppId,
    required this.firebaseIosAppId,
    required this.firebaseWebAppId,
    required this.androidApplicationId,
    required this.iosBundleId,
    required this.functionsRegion,
  });

  factory AppEnvironment.fromEnvironment() {
    return const AppEnvironment(
      appName: String.fromEnvironment(
        'APP_NAME',
        defaultValue: 'DictaCoach',
      ),
      appFlavor: String.fromEnvironment(
        'APP_ENV',
        defaultValue: 'development',
      ),
      useFirebase: bool.fromEnvironment(
        'USE_FIREBASE',
        defaultValue: false,
      ),
      pipelineMode: String.fromEnvironment(
        'PIPELINE_MODE',
        defaultValue: 'mock',
      ),
      apiBaseUrl: String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: '',
      ),
      apiPollIntervalSeconds: int.fromEnvironment(
        'API_POLL_INTERVAL_SECONDS',
        defaultValue: 3,
      ),
      apiReadyTimeoutSeconds: int.fromEnvironment(
        'API_READY_TIMEOUT_SECONDS',
        defaultValue: 90,
      ),
      demoUserId: String.fromEnvironment(
        'DEMO_USER_ID',
        defaultValue: 'demo-user',
      ),
      demoUserEmail: String.fromEnvironment(
        'DEMO_USER_EMAIL',
        defaultValue: 'student@dictacoach.local',
      ),
      demoUserName: String.fromEnvironment(
        'DEMO_USER_NAME',
        defaultValue: 'Demo Student',
      ),
      transcriptionProvider: String.fromEnvironment(
        'TRANSCRIPTION_PROVIDER',
        defaultValue: 'mock',
      ),
      llmProvider: String.fromEnvironment(
        'LLM_PROVIDER',
        defaultValue: 'mock',
      ),
      embeddingsProvider: String.fromEnvironment(
        'EMBEDDINGS_PROVIDER',
        defaultValue: 'mock',
      ),
      firebaseApiKey: String.fromEnvironment('FIREBASE_API_KEY'),
      firebaseAuthDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
      firebaseProjectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
      firebaseStorageBucket: String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
      firebaseMessagingSenderId: String.fromEnvironment(
        'FIREBASE_MESSAGING_SENDER_ID',
      ),
      firebaseAndroidAppId: String.fromEnvironment(
        'FIREBASE_ANDROID_APP_ID',
      ),
      firebaseIosAppId: String.fromEnvironment('FIREBASE_IOS_APP_ID'),
      firebaseWebAppId: String.fromEnvironment('FIREBASE_WEB_APP_ID'),
      androidApplicationId: String.fromEnvironment(
        'ANDROID_APPLICATION_ID',
        defaultValue: 'com.example.dictacoach',
      ),
      iosBundleId: String.fromEnvironment(
        'IOS_BUNDLE_ID',
        defaultValue: 'com.example.dictacoach',
      ),
      functionsRegion: String.fromEnvironment(
        'FUNCTIONS_REGION',
        defaultValue: 'us-central1',
      ),
    );
  }

  final String appName;
  final String appFlavor;
  final bool useFirebase;
  final String pipelineMode;
  final String apiBaseUrl;
  final int apiPollIntervalSeconds;
  final int apiReadyTimeoutSeconds;
  final String demoUserId;
  final String demoUserEmail;
  final String demoUserName;
  final String transcriptionProvider;
  final String llmProvider;
  final String embeddingsProvider;
  final String firebaseApiKey;
  final String firebaseAuthDomain;
  final String firebaseProjectId;
  final String firebaseStorageBucket;
  final String firebaseMessagingSenderId;
  final String firebaseAndroidAppId;
  final String firebaseIosAppId;
  final String firebaseWebAppId;
  final String androidApplicationId;
  final String iosBundleId;
  final String functionsRegion;

  bool get useFastApiPipeline {
    return pipelineMode.toLowerCase() == 'fastapi' && apiBaseUrl.trim().isNotEmpty;
  }

  bool get hasFirebaseCoreConfig {
    return firebaseApiKey.isNotEmpty &&
        firebaseProjectId.isNotEmpty &&
        firebaseMessagingSenderId.isNotEmpty &&
        firebaseAppIdForPlatform != null;
  }

  String? get firebaseAppIdForPlatform {
    if (kIsWeb) {
      return firebaseWebAppId.isEmpty ? null : firebaseWebAppId;
    }

    return switch (defaultTargetPlatform) {
      TargetPlatform.android =>
        firebaseAndroidAppId.isEmpty ? null : firebaseAndroidAppId,
      TargetPlatform.iOS =>
        firebaseIosAppId.isEmpty ? null : firebaseIosAppId,
      _ => firebaseWebAppId.isEmpty ? null : firebaseWebAppId,
    };
  }

  FirebaseOptions? get firebaseOptions {
    final appId = firebaseAppIdForPlatform;
    if (!hasFirebaseCoreConfig || appId == null) {
      return null;
    }

    return FirebaseOptions(
      apiKey: firebaseApiKey,
      appId: appId,
      messagingSenderId: firebaseMessagingSenderId,
      projectId: firebaseProjectId,
      authDomain: firebaseAuthDomain.isEmpty ? null : firebaseAuthDomain,
      storageBucket: firebaseStorageBucket.isEmpty
          ? null
          : firebaseStorageBucket,
      iosBundleId: iosBundleId,
    );
  }
}
