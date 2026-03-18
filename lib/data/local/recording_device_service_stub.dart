import '../../domain/models/captured_audio.dart';
import '../../domain/services/pipeline_services.dart';

RecordingDeviceService createRecordingDeviceService() {
  return const UnsupportedRecordingDeviceService();
}

class UnsupportedRecordingDeviceService implements RecordingDeviceService {
  const UnsupportedRecordingDeviceService();

  @override
  bool get isSupported => false;

  @override
  Future<void> cancel() async {}

  @override
  Future<void> pause() async {
    throw UnsupportedError('Recording is not supported on this platform.');
  }

  @override
  Future<void> resume() async {
    throw UnsupportedError('Recording is not supported on this platform.');
  }

  @override
  Future<void> start({required String sessionId}) async {
    throw UnsupportedError('Recording is not supported on this platform.');
  }

  @override
  Future<CapturedAudio> stop({required Duration duration}) async {
    throw UnsupportedError('Recording is not supported on this platform.');
  }
}
