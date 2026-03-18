import 'package:cross_file/cross_file.dart';

class CapturedAudio {
  const CapturedAudio({
    required this.id,
    required this.file,
    required this.duration,
    required this.createdAt,
  });

  final String id;
  final XFile file;
  final Duration duration;
  final DateTime createdAt;
}
