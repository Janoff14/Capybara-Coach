import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/note_generation.dart';
import '../../domain/services/pipeline_services.dart';

class MockAudioStorageService implements AudioStorageService {
  const MockAudioStorageService();

  @override
  String get providerKey => 'mock-storage';

  @override
  Future<StoredAudioAsset> upload({
    required AppUser user,
    required CapturedAudio recording,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return StoredAudioAsset(
      downloadUrl: 'mock://audio/${user.id}/${recording.id}.m4a',
      storagePath: 'users/${user.id}/recordings/${recording.id}.m4a',
      providerKey: providerKey,
    );
  }
}
