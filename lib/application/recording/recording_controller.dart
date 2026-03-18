import 'dart:async';

import 'package:flutter_riverpod/legacy.dart';
import 'package:uuid/uuid.dart';

import '../../domain/models/app_user.dart';
import '../../domain/models/assistant_mood.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/recording_phase.dart';
import '../../domain/models/study_note.dart';
import '../../domain/services/pipeline_services.dart';
import '../../domain/services/voice_note_pipeline_service.dart';
import '../assistant/assistant_controller.dart';
import 'recording_state.dart';

class RecordingController extends StateNotifier<RecordingState> {
  RecordingController({
    required AppUser currentUser,
    required RecordingDeviceService recordingDeviceService,
    required VoiceNotePipelineService voiceNotePipelineService,
    required AssistantController assistantController,
  })  : _currentUser = currentUser,
        _recordingDeviceService = recordingDeviceService,
        _voiceNotePipelineService = voiceNotePipelineService,
        _assistantController = assistantController,
        super(RecordingState.initial(
          recorderSupported: recordingDeviceService.isSupported,
        ));

  final _uuid = const Uuid();
  final AppUser _currentUser;
  final RecordingDeviceService _recordingDeviceService;
  final VoiceNotePipelineService _voiceNotePipelineService;
  final AssistantController _assistantController;

  Timer? _ticker;
  DateTime? _startedAt;
  Duration _elapsedBeforePause = Duration.zero;

  Future<void> startRecording() async {
    if (!_recordingDeviceService.isSupported || state.isBusy) {
      return;
    }

    try {
      final sessionId = _uuid.v4();
      await _recordingDeviceService.start(sessionId: sessionId);

      _elapsedBeforePause = Duration.zero;
      _startedAt = DateTime.now();
      _startTicker();
      _assistantController.setMood(AssistantMood.listening);

      state = state.copyWith(
        phase: RecordingPhase.recording,
        elapsed: Duration.zero,
        statusMessage: 'Listening... pause when you need a beat, then stop to review.',
        clearPendingAudio: true,
        clearErrorMessage: true,
      );
    } catch (error) {
      _setError(
        'Microphone access failed. Check permissions and try again.',
        error,
      );
    }
  }

  Future<void> pauseRecording() async {
    if (state.phase != RecordingPhase.recording) {
      return;
    }

    try {
      await _recordingDeviceService.pause();
      _elapsedBeforePause = state.elapsed;
      _startedAt = null;
      _stopTicker();
      _assistantController.setMood(AssistantMood.idle);

      state = state.copyWith(
        phase: RecordingPhase.paused,
        statusMessage: 'Paused. Resume when you are ready, or stop to prepare the note.',
      );
    } catch (error) {
      _setError('Could not pause the recording.', error);
    }
  }

  Future<void> resumeRecording() async {
    if (state.phase != RecordingPhase.paused) {
      return;
    }

    try {
      await _recordingDeviceService.resume();
      _startedAt = DateTime.now();
      _startTicker();
      _assistantController.setMood(AssistantMood.listening);

      state = state.copyWith(
        phase: RecordingPhase.recording,
        statusMessage: 'Listening again... keep going until the idea is complete.',
      );
    } catch (error) {
      _setError('Could not resume the recording.', error);
    }
  }

  Future<void> stopRecording() async {
    if (state.phase != RecordingPhase.recording &&
        state.phase != RecordingPhase.paused) {
      return;
    }

    try {
      _stopTicker();
      final capturedAudio = await _recordingDeviceService.stop(
        duration: state.elapsed,
      );
      _startedAt = null;
      _elapsedBeforePause = Duration.zero;
      _assistantController.setMood(AssistantMood.idle);

      state = state.copyWith(
        phase: RecordingPhase.review,
        pendingAudio: capturedAudio,
        statusMessage: 'Clip ready. Save it to run transcription and note-building.',
      );
    } catch (error) {
      _setError('Could not finalize the recording.', error);
    }
  }

  Future<void> discardRecording() async {
    if (state.phase == RecordingPhase.recording ||
        state.phase == RecordingPhase.paused) {
      await _recordingDeviceService.cancel();
    }

    _stopTicker();
    _startedAt = null;
    _elapsedBeforePause = Duration.zero;
    _assistantController.setMood(AssistantMood.idle);

    state = RecordingState.initial(
      recorderSupported: _recordingDeviceService.isSupported,
    ).copyWith(
      lastSavedNoteId: state.lastSavedNoteId,
    );
  }

  Future<void> saveRecording() async {
    final pendingAudio = state.pendingAudio;

    if (pendingAudio == null || state.phase != RecordingPhase.review) {
      return;
    }

    try {
      _assistantController.setMood(AssistantMood.thinking);
      state = state.copyWith(
        phase: RecordingPhase.uploading,
        statusMessage: 'Uploading audio to the backend...',
        clearErrorMessage: true,
      );

      final finalNote = await _voiceNotePipelineService.processRecording(
        user: _currentUser,
        recording: pendingAudio,
        onProgress: _handleProgressUpdate,
      );

      state = state.copyWith(
        phase: RecordingPhase.saved,
        elapsed: Duration.zero,
        statusMessage: 'Saved. Your note is ready to review.',
        lastSavedNoteId: finalNote.id,
        clearPendingAudio: true,
        clearProcessingNoteId: true,
      );

      await _assistantController.celebrateSave();
    } catch (error) {
      _setError('Note processing failed. Try again or inspect backend setup.', error);
    }
  }

  void _handleProgressUpdate(StudyNote note) {
    state = state.copyWith(
      phase: _phaseForNote(note),
      statusMessage: _statusMessageForNote(note),
      processingNoteId: note.id,
      clearErrorMessage: true,
    );
  }

  RecordingPhase _phaseForNote(StudyNote note) {
    return switch (note.aiProcessingStatus) {
      NoteProcessingStatus.uploading => RecordingPhase.uploading,
      NoteProcessingStatus.transcribing => RecordingPhase.transcribing,
      NoteProcessingStatus.generating => RecordingPhase.generating,
      NoteProcessingStatus.organizing => RecordingPhase.organizing,
      NoteProcessingStatus.ready => RecordingPhase.saving,
      NoteProcessingStatus.failed => RecordingPhase.error,
      _ => RecordingPhase.uploading,
    };
  }

  String _statusMessageForNote(StudyNote note) {
    return switch (note.aiProcessingStatus) {
      NoteProcessingStatus.uploading =>
        'Uploading audio to the backend and creating a note record...',
      NoteProcessingStatus.transcribing =>
        'Transcribing your recording with speech-to-text...',
      NoteProcessingStatus.generating =>
        'Turning the transcript into a structured study note...',
      NoteProcessingStatus.organizing =>
        'Finishing the note and organizing the result...',
      NoteProcessingStatus.ready =>
        'Structured note ready. Saving it into your review library...',
      NoteProcessingStatus.failed =>
        note.cleanedSummary.isNotEmpty ? note.cleanedSummary : 'The backend reported a failure.',
      _ => 'Processing your recording...',
    };
  }

  String _formatError(Object error) {
    if (error is TimeoutException) {
      return 'The backend is taking longer than expected. Check the note again in a moment.';
    }
    return error.toString();
  }

  void _setError(String message, Object error) {
    _stopTicker();
    _startedAt = null;
    _elapsedBeforePause = Duration.zero;
    _assistantController.signalError();
    state = state.copyWith(
      phase: RecordingPhase.error,
      statusMessage: message,
      errorMessage: _formatError(error),
    );
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final startedAt = _startedAt;
      if (startedAt == null) {
        return;
      }

      final elapsed = _elapsedBeforePause + DateTime.now().difference(startedAt);
      state = state.copyWith(elapsed: elapsed);
    });
  }

  void _stopTicker() {
    _ticker?.cancel();
    _ticker = null;
  }

  @override
  void dispose() {
    _stopTicker();
    super.dispose();
  }
}
