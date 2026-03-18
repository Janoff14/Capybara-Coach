import 'dart:io';

import 'package:cross_file/cross_file.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../domain/models/captured_audio.dart';
import '../../domain/services/pipeline_services.dart';

RecordingDeviceService createRecordingDeviceService() {
  return MobileRecordingDeviceService();
}

class MobileRecordingDeviceService implements RecordingDeviceService {
  final AudioRecorder _recorder = AudioRecorder();

  String? _currentPath;
  DateTime? _createdAt;

  @override
  bool get isSupported => true;

  @override
  Future<void> cancel() async {
    final pathValue = await _recorder.stop();
    final filePath = pathValue ?? _currentPath;

    if (filePath != null) {
      final file = File(filePath);
      if (await file.exists()) {
        await file.delete();
      }
    }

    _currentPath = null;
    _createdAt = null;
  }

  @override
  Future<void> pause() {
    return _recorder.pause();
  }

  @override
  Future<void> resume() {
    return _recorder.resume();
  }

  @override
  Future<void> start({required String sessionId}) async {
    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission) {
      throw StateError('Microphone permission was not granted.');
    }

    final directory = await getTemporaryDirectory();
    final filePath = path.join(directory.path, 'dictacoach-$sessionId.m4a');

    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
      ),
      path: filePath,
    );

    _currentPath = filePath;
    _createdAt = DateTime.now();
  }

  @override
  Future<CapturedAudio> stop({required Duration duration}) async {
    final filePath = await _recorder.stop() ?? _currentPath;
    if (filePath == null || filePath.isEmpty) {
      throw StateError('No audio file was written for this recording.');
    }

    final basename = path.basenameWithoutExtension(filePath);
    final file = XFile(filePath, name: path.basename(filePath));

    final capturedAudio = CapturedAudio(
      id: basename,
      file: file,
      duration: duration,
      createdAt: _createdAt ?? DateTime.now(),
    );

    _currentPath = null;
    _createdAt = null;
    return capturedAudio;
  }
}
