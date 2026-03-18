import '../models/app_user.dart';
import '../models/captured_audio.dart';
import '../models/study_note.dart';

typedef VoiceNoteProgressCallback = void Function(StudyNote note);

abstract class VoiceNotePipelineService {
  String get providerKey;

  Future<StudyNote> processRecording({
    required AppUser user,
    required CapturedAudio recording,
    VoiceNoteProgressCallback? onProgress,
  });
}
