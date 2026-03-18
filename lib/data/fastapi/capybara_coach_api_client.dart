import 'dart:convert';

import 'package:collection/collection.dart';
import 'package:http/http.dart' as http;

import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/folder_entity.dart';
import '../../domain/models/learning_session.dart';
import '../../domain/models/learning_source.dart';
import '../../domain/models/note_processing.dart';
import '../../domain/models/study_note.dart';

class SubmittedVoiceUpload {
  const SubmittedVoiceUpload({
    required this.uploadId,
    required this.noteId,
    required this.status,
  });

  final String uploadId;
  final String noteId;
  final NoteProcessingStatus status;
}

class GeneratedStudySessionNote {
  const GeneratedStudySessionNote({
    required this.session,
    required this.note,
  });

  final LearningSession session;
  final StudyNote note;
}

class CapybaraCoachApiClient {
  CapybaraCoachApiClient({
    required String baseUrl,
    http.Client? httpClient,
  })  : _baseUri = _normalizeBaseUri(baseUrl),
        _httpClient = httpClient ?? http.Client();

  final Uri _baseUri;
  final http.Client _httpClient;

  Future<SubmittedVoiceUpload> uploadAudio({
    required AppUser user,
    required CapturedAudio recording,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _resolveUri('audio/upload'),
    )
      ..fields['user_id'] = user.id
      ..fields['email'] = user.email
      ..fields['display_name'] = user.displayName
      ..fields['auto_process'] = 'true';

    request.files.add(
      await http.MultipartFile.fromPath(
        'audio',
        recording.file.path,
        filename: recording.file.name,
      ),
    );

    final response = await _sendMultipart(request);
    final payload = _decodeObject(response.body);
    return SubmittedVoiceUpload(
      uploadId: payload['upload_id'] as String? ?? '',
      noteId: payload['note_id'] as String? ?? '',
      status: _mapNoteStatus(payload['status'] as String?),
    );
  }

  Future<LearningSource> importDocument({
    required AppUser user,
    required LearningSourceType sourceType,
    required String title,
    required String subtitle,
    String? rawText,
    List<int>? fileBytes,
    String? fileName,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _resolveUri('documents/import'),
    )
      ..fields['user_id'] = user.id
      ..fields['email'] = user.email
      ..fields['display_name'] = user.displayName
      ..fields['title'] = title
      ..fields['subtitle'] = subtitle;

    final trimmedText = rawText?.trim();
    if (trimmedText != null && trimmedText.isNotEmpty) {
      request.fields['raw_text'] = trimmedText;
    }

    if (fileBytes != null && fileBytes.isNotEmpty && fileName != null) {
      request.files.add(
        http.MultipartFile.fromBytes(
          'document_file',
          fileBytes,
          filename: fileName,
        ),
      );
    }

    final response = await _sendMultipart(request);
    final payload = _decodeObject(response.body);
    return _mapLearningSource(payload, fallbackUserId: user.id);
  }

  Future<List<LearningSource>> listLearningSources({
    required AppUser user,
  }) async {
    final response = await _httpClient.get(
      _resolveUri(
        'documents',
        queryParameters: {'user_id': user.id},
      ),
    );
    _throwIfNotSuccessful(response);

    final payload = _decodeList(response.body);
    final futures = payload.map(
      (item) => fetchLearningSource(
        user: user,
        sourceId: item['id'] as String? ?? '',
      ),
    );
    final sources = await Future.wait(futures);
    sources.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return sources;
  }

  Future<LearningSource> fetchLearningSource({
    required AppUser user,
    required String sourceId,
  }) async {
    final response = await _httpClient.get(_resolveUri('documents/$sourceId'));
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    return _mapLearningSource(payload, fallbackUserId: user.id);
  }

  Future<LearningSession> createStudySession({
    required AppUser user,
    required LearningSource source,
    required LearningSection section,
    required LearningSessionMode mode,
  }) async {
    final response = await _httpClient.post(
      _resolveUri('sessions'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'user_id': user.id,
        'email': user.email,
        'display_name': user.displayName,
        'document_id': source.id,
        'section_id': section.id,
        'mode': mode.name,
      }),
    );
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    return _mapLearningSession(
      payload,
      source: source,
      section: section,
      fallbackUserId: user.id,
    );
  }

  Future<List<LearningSession>> listStudySessions({
    required AppUser user,
    required List<LearningSource> sources,
  }) async {
    final response = await _httpClient.get(
      _resolveUri(
        'sessions',
        queryParameters: {'user_id': user.id},
      ),
    );
    _throwIfNotSuccessful(response);

    final payload = _decodeList(response.body);
    final futures = payload.map(
      (item) => fetchStudySession(
        user: user,
        sessionId: item['id'] as String? ?? '',
        sources: sources,
      ),
    );
    final sessions = await Future.wait(futures);
    sessions.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return sessions;
  }

  Future<LearningSession> fetchStudySession({
    required AppUser user,
    required String sessionId,
    required List<LearningSource> sources,
  }) async {
    final response = await _httpClient.get(_resolveUri('sessions/$sessionId'));
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    return _mapLearningSession(
      payload,
      sources: sources,
      fallbackUserId: user.id,
    );
  }

  Future<LearningSession> evaluateStudySessionAudio({
    required AppUser user,
    required LearningSession session,
    required CapturedAudio recording,
    required Duration actualReadDuration,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _resolveUri('sessions/${session.id}/evaluate-audio'),
    )
      ..fields['actual_read_seconds'] = actualReadDuration.inSeconds.toString();

    request.files.add(
      await http.MultipartFile.fromPath(
        'audio',
        recording.file.path,
        filename: recording.file.name,
      ),
    );

    final response = await _sendMultipart(request);
    final payload = _decodeObject(response.body);
    return _mapLearningSession(
      payload,
      source: LearningSource(
        id: session.sourceId,
        userId: session.userId,
        title: session.sourceTitle,
        subtitle: '',
        type: session.sourceType,
        sections: [
          LearningSection(
            id: session.sectionId,
            title: session.sectionTitle,
            pageLabel: '',
            order: 0,
            extractedText: session.sourceText,
            estimatedReadMinutes: session.targetReadDuration.inMinutes,
            difficulty: LearningDifficulty.standard,
            conceptCount: session.feedback?.breakdown.missingConceptCount ?? 4,
          ),
        ],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      ),
      existingSession: session,
      fallbackUserId: user.id,
    );
  }

  Future<GeneratedStudySessionNote> generateStudySessionNote({
    required AppUser user,
    required LearningSession session,
  }) async {
    final response = await _httpClient.post(
      _resolveUri('sessions/${session.id}/generate-note'),
    );
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    final sessionPayload = payload['session'];
    final notePayload = payload['note'];
    if (sessionPayload is! Map || notePayload is! Map) {
      throw const FormatException('Expected a session and note payload.');
    }

    final mappedSession = _mapLearningSession(
      _toStringKeyMap(sessionPayload),
      source: LearningSource(
        id: session.sourceId,
        userId: session.userId,
        title: session.sourceTitle,
        subtitle: '',
        type: session.sourceType,
        sections: [
          LearningSection(
            id: session.sectionId,
            title: session.sectionTitle,
            pageLabel: '',
            order: 0,
            extractedText: session.sourceText,
            estimatedReadMinutes: session.targetReadDuration.inMinutes,
            difficulty: LearningDifficulty.standard,
            conceptCount: session.feedback?.breakdown.missingConceptCount ?? 4,
          ),
        ],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      ),
      existingSession: session,
      fallbackUserId: user.id,
    );
    final mappedNote = _mapNote(
      _toStringKeyMap(notePayload),
      fallbackUserId: user.id,
      fallbackSourceDuration: session.actualReadDuration,
    );

    return GeneratedStudySessionNote(
      session: mappedSession,
      note: mappedNote,
    );
  }

  Future<StudyNote> fetchNote({
    required AppUser user,
    required String noteId,
  }) async {
    final response = await _httpClient.get(_resolveUri('notes/$noteId'));
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    return _mapNote(
      payload,
      fallbackUserId: user.id,
    );
  }

  Future<List<StudyNote>> listNotes({
    required AppUser user,
  }) async {
    final response = await _httpClient.get(
      _resolveUri(
        'notes',
        queryParameters: {'user_id': user.id},
      ),
    );
    _throwIfNotSuccessful(response);

    final payload = _decodeList(response.body);
    return payload
        .map((item) => _mapNoteListItem(item, fallbackUserId: user.id))
        .toList();
  }

  Future<List<FolderEntity>> listFolders({
    required AppUser user,
  }) async {
    final response = await _httpClient.get(
      _resolveUri(
        'folders',
        queryParameters: {'user_id': user.id},
      ),
    );
    _throwIfNotSuccessful(response);

    final payload = _decodeList(response.body);
    return payload
        .map((item) => _mapFolder(item, fallbackUserId: user.id))
        .toList();
  }

  static Uri _normalizeBaseUri(String rawBaseUrl) {
    final normalized = rawBaseUrl.trim().endsWith('/')
        ? rawBaseUrl.trim()
        : '${rawBaseUrl.trim()}/';
    return Uri.parse(normalized);
  }

  Uri _resolveUri(
    String path, {
    Map<String, String>? queryParameters,
  }) {
    final resolved = _baseUri.resolve(path);
    return queryParameters == null
        ? resolved
        : resolved.replace(queryParameters: queryParameters);
  }

  Future<http.Response> _sendMultipart(http.MultipartRequest request) async {
    final streamedResponse = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    _throwIfNotSuccessful(response);
    return response;
  }

  void _throwIfNotSuccessful(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    throw StateError(
      'Backend request failed with ${response.statusCode}: ${response.body}',
    );
  }

  Map<String, dynamic> _decodeObject(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Expected a JSON object.');
    }
    return decoded;
  }

  List<Map<String, dynamic>> _decodeList(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! List) {
      throw const FormatException('Expected a JSON array.');
    }

    return decoded
        .whereType<Map>()
        .map(_toStringKeyMap)
        .toList();
  }

  Map<String, dynamic> _toStringKeyMap(Map item) {
    return item.map((key, value) => MapEntry(key.toString(), value));
  }

  LearningSource _mapLearningSource(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
  }) {
    final sectionsPayload = payload['sections'];
    final sections = sectionsPayload is List
        ? sectionsPayload
            .whereType<Map>()
            .map(_toStringKeyMap)
            .map(_mapLearningSection)
            .toList()
        : const <LearningSection>[];
    sections.sort((a, b) => a.order.compareTo(b.order));

    return LearningSource(
      id: payload['id'] as String? ?? '',
      userId: payload['user_id'] as String? ?? fallbackUserId,
      title: payload['title'] as String? ?? 'Imported document',
      subtitle: payload['subtitle'] as String? ?? 'Study material',
      type: _mapLearningSourceType(payload['source_type'] as String?),
      sections: sections,
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: _parseDateTime(payload['updated_at']),
    );
  }

  LearningSection _mapLearningSection(Map<String, dynamic> payload) {
    return LearningSection(
      id: payload['id'] as String? ?? '',
      title: payload['title'] as String? ?? 'Section',
      pageLabel: payload['page_label'] as String? ?? 'Selected section',
      order: _parseInt(payload['order_index']) ?? 0,
      extractedText: payload['extracted_text'] as String? ?? '',
      estimatedReadMinutes: _parseInt(payload['estimated_read_minutes']) ?? 5,
      difficulty: _mapLearningDifficulty(payload['difficulty'] as String?),
      conceptCount: _parseInt(payload['concept_count']) ?? 4,
    );
  }

  LearningSession _mapLearningSession(
    Map<String, dynamic> payload, {
    List<LearningSource>? sources,
    LearningSource? source,
    LearningSection? section,
    LearningSession? existingSession,
    required String fallbackUserId,
  }) {
    final fallbackSource = existingSession == null
        ? LearningSource(
            id: payload['document_id'] as String? ?? '',
            userId: payload['user_id'] as String? ?? fallbackUserId,
            title: payload['document_title'] as String? ?? 'Document',
            subtitle: 'Study material',
            type: LearningSourceType.text,
            sections: const <LearningSection>[],
            createdAt: _parseDateTime(payload['created_at']),
            updatedAt: _parseDateTime(payload['updated_at']),
          )
        : LearningSource(
            id: existingSession.sourceId,
            userId: existingSession.userId,
            title: existingSession.sourceTitle,
            subtitle: 'Study material',
            type: existingSession.sourceType,
            sections: [
              LearningSection(
                id: existingSession.sectionId,
                title: existingSession.sectionTitle,
                pageLabel: payload['section_page_label'] as String? ?? '',
                order: 0,
                extractedText: existingSession.sourceText,
                estimatedReadMinutes: existingSession.targetReadDuration.inMinutes,
                difficulty: LearningDifficulty.standard,
                conceptCount:
                    existingSession.feedback?.breakdown.missingConceptCount ?? 4,
              ),
            ],
            createdAt: existingSession.createdAt,
            updatedAt: existingSession.updatedAt,
          );
    final resolvedSource =
        source ??
        sources?.firstWhereOrNull(
          (item) => item.id == (payload['document_id'] as String? ?? ''),
        ) ??
        fallbackSource;
    final resolvedSection = section ??
        resolvedSource.sections.firstWhereOrNull(
          (item) => item.id == (payload['section_id'] as String? ?? ''),
        ) ??
        (existingSession == null
            ? null
            : LearningSection(
                id: existingSession.sectionId,
                title: existingSession.sectionTitle,
                pageLabel: payload['section_page_label'] as String? ?? '',
                order: 0,
                extractedText: existingSession.sourceText,
                estimatedReadMinutes: existingSession.targetReadDuration.inMinutes,
                difficulty: LearningDifficulty.standard,
                conceptCount:
                    existingSession.feedback?.breakdown.missingConceptCount ?? 4,
              )) ??
        LearningSection(
          id: payload['section_id'] as String? ?? '',
          title: payload['section_title'] as String? ?? 'Selected section',
          pageLabel: payload['section_page_label'] as String? ?? 'Selected section',
          order: 0,
          extractedText: existingSession?.sourceText ?? '',
          estimatedReadMinutes:
              existingSession?.targetReadDuration.inMinutes ??
                  5,
          difficulty: LearningDifficulty.standard,
          conceptCount: 4,
        );

    final feedback = _mapSessionFeedback(payload);

    return LearningSession(
      id: payload['id'] as String? ?? '',
      userId: payload['user_id'] as String? ?? fallbackUserId,
      sourceId: resolvedSource.id,
      sourceTitle:
          payload['document_title'] as String? ?? resolvedSource.title,
      sourceType: resolvedSource.type,
      sectionId: resolvedSection.id,
      sectionTitle:
          payload['section_title'] as String? ?? resolvedSection.title,
      mode: _mapLearningSessionMode(payload['mode'] as String?),
      phase: _mapLearningSessionPhase(payload['status'] as String?),
      sourceText: resolvedSection.extractedText,
      targetReadDuration: Duration(
        minutes: resolvedSection.estimatedReadMinutes.clamp(1, 999).toInt(),
      ),
      actualReadDuration: Duration(
        seconds: _parseInt(payload['actual_read_seconds']) ?? 0,
      ),
      attemptCount: _parseInt(payload['attempt_count']) ?? 0,
      recallPrompt: _promptForMode(
        _mapLearningSessionMode(payload['mode'] as String?),
      ),
      recallTranscript: payload['recall_transcript'] as String?,
      feedback: feedback,
      noteId: payload['note_id'] as String?,
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: _parseDateTime(payload['updated_at']),
      errorMessage: payload['error_message'] as String?,
    );
  }

  SessionFeedback? _mapSessionFeedback(Map<String, dynamic> payload) {
    final totalScore = _parseInt(payload['score_total']);
    if (totalScore == null) {
      return null;
    }

    return SessionFeedback(
      breakdown: SessionScoreBreakdown(
        totalScore: totalScore,
        recallScore: _parseInt(payload['recall_score']) ?? 0,
        accuracyScore: _parseInt(payload['accuracy_score']) ?? 0,
        detailScore: _parseInt(payload['detail_score']) ?? 0,
        missingConceptCount: _parseInt(payload['missing_concept_count']) ?? 0,
        misconceptionCount: _parseInt(payload['misconception_count']) ?? 0,
      ),
      strengths: _toStringList(payload['strengths']),
      specificFeedback: _toStringList(payload['specific_feedback']),
      missingPieces: _toStringList(payload['missing_pieces']),
      misconceptions: _toStringList(payload['misconceptions']),
      thresholdScore: _parseInt(payload['threshold_score']) ?? 70,
    );
  }

  StudyNote _mapNote(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
    Duration fallbackSourceDuration = Duration.zero,
  }) {
    final cleanedContent =
        payload['cleaned_content'] as String? ??
        payload['raw_transcript'] as String? ??
        'Your structured note is still being prepared.';
    final summary =
        payload['summary'] as String? ??
        'Capybara Coach is preparing this note.';
    final folderId = payload['folder_id'] as String?;
    final folderTitle = payload['folder_title'] as String?;
    final tags = _toStringList(payload['tags']);
    final keyTerms = _toStringList(payload['key_terms']);
    final suggestedFolder = payload['suggested_folder'] as String?;
    final topics = {
      if (folderTitle != null && folderTitle.trim().isNotEmpty)
        folderTitle.trim(),
      if (suggestedFolder != null && suggestedFolder.trim().isNotEmpty)
        suggestedFolder.trim(),
      ...tags,
    }.toList();

    return StudyNote(
      id: payload['id'] as String? ?? '',
      userId: payload['user_id'] as String? ?? fallbackUserId,
      folderId: folderId,
      sourceAudioUrl: null,
      rawTranscript: payload['raw_transcript'] as String? ?? '',
      cleanedTitle:
          payload['title'] as String? ?? 'Processing your latest recording',
      cleanedSummary: summary,
      cleanedContent: cleanedContent,
      keyIdeas: _extractKeyIdeas(cleanedContent),
      reviewQuestions: _toStringList(payload['review_questions']),
      keyTerms: keyTerms,
      tags: tags,
      topics: topics,
      relatedNoteIds: const <String>[],
      aiProcessingStatus: _mapNoteStatus(payload['processing_status'] as String?),
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: _parseDateTime(payload['updated_at']),
      sourceDuration: fallbackSourceDuration,
    );
  }

  StudyNote _mapNoteListItem(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
  }) {
    final summary =
        payload['summary'] as String? ?? 'Open this note to review the content.';
    final title = payload['title'] as String? ?? 'Untitled note';
    final folderTitle = payload['folder_title'] as String?;
    final tags = _toStringList(payload['tags']);

    return StudyNote(
      id: payload['id'] as String? ?? '',
      userId: payload['user_id'] as String? ?? fallbackUserId,
      folderId: payload['folder_id'] as String?,
      sourceAudioUrl: null,
      rawTranscript: '',
      cleanedTitle: title,
      cleanedSummary: summary,
      cleanedContent: summary,
      keyIdeas: const <String>[],
      reviewQuestions: const <String>[],
      keyTerms: const <String>[],
      tags: tags,
      topics: [
        if (folderTitle != null && folderTitle.trim().isNotEmpty)
          folderTitle.trim(),
      ],
      relatedNoteIds: const <String>[],
      aiProcessingStatus: _mapNoteStatus(payload['processing_status'] as String?),
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: _parseDateTime(payload['updated_at']),
      sourceDuration: Duration.zero,
    );
  }

  FolderEntity _mapFolder(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
  }) {
    final title = payload['title'] as String? ?? 'Untitled folder';
    return FolderEntity(
      id: payload['id'] as String? ?? '',
      userId: fallbackUserId,
      title: title,
      description:
          payload['description'] as String? ??
          'Auto-organized notes for $title.',
      parentFolderId: null,
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: _parseDateTime(payload['updated_at']),
      aiGenerated: true,
    );
  }

  List<String> _toStringList(Object? value) {
    if (value is! List) {
      return const <String>[];
    }

    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  int? _parseInt(Object? value) {
    if (value is int) {
      return value;
    }
    return int.tryParse(value?.toString() ?? '');
  }

  DateTime _parseDateTime(Object? value) {
    final text = value?.toString();
    if (text == null || text.isEmpty) {
      return DateTime.now();
    }
    return DateTime.tryParse(text)?.toLocal() ?? DateTime.now();
  }

  List<String> _extractKeyIdeas(String cleanedContent) {
    final lines = cleanedContent
        .split(RegExp(r'\r?\n'))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();

    final bulletLines = lines
        .where((line) => line.startsWith('- ') || line.startsWith('* '))
        .map((line) => line.substring(2).trim())
        .where((line) => line.isNotEmpty)
        .take(4)
        .toList();

    if (bulletLines.isNotEmpty) {
      return bulletLines;
    }

    return lines
        .where((line) => !line.endsWith(':') && line.length > 20)
        .take(4)
        .toList();
  }

  LearningSourceType _mapLearningSourceType(String? rawType) {
    return switch (rawType?.toLowerCase().trim()) {
      'pdf' => LearningSourceType.pdf,
      'link' => LearningSourceType.link,
      'voice' || 'voice_note' || 'voicenote' => LearningSourceType.voiceNote,
      _ => LearningSourceType.text,
    };
  }

  LearningDifficulty _mapLearningDifficulty(String? rawDifficulty) {
    return switch (rawDifficulty?.toLowerCase().trim()) {
      'beginner' => LearningDifficulty.beginner,
      'advanced' => LearningDifficulty.advanced,
      _ => LearningDifficulty.standard,
    };
  }

  LearningSessionMode _mapLearningSessionMode(String? rawMode) {
    return switch (rawMode?.toLowerCase().trim()) {
      'strict' => LearningSessionMode.strict,
      _ => LearningSessionMode.assisted,
    };
  }

  LearningSessionPhase _mapLearningSessionPhase(String? rawStatus) {
    return switch (rawStatus?.toLowerCase().trim()) {
      'reading' => LearningSessionPhase.reading,
      'ready_to_recall' => LearningSessionPhase.readyToRecall,
      'recording_recall' => LearningSessionPhase.recordingRecall,
      'review_recording' => LearningSessionPhase.reviewRecording,
      'transcribing' => LearningSessionPhase.transcribing,
      'evaluating' => LearningSessionPhase.evaluating,
      'feedback_ready' => LearningSessionPhase.feedbackReady,
      'generating_note' => LearningSessionPhase.generatingNote,
      'complete' => LearningSessionPhase.complete,
      'failed' || 'error' => LearningSessionPhase.error,
      _ => LearningSessionPhase.idle,
    };
  }

  String _promptForMode(LearningSessionMode mode) {
    return switch (mode) {
      LearningSessionMode.assisted =>
        'Explain what you just read in your own words. What are the key ideas and what would someone misunderstand?',
      LearningSessionMode.strict =>
        'Retell the section from memory with definitions, edge cases, names, examples, and precise distinctions.',
    };
  }
}

NoteProcessingStatus _mapNoteStatus(String? rawStatus) {
  return switch (rawStatus?.toLowerCase().trim()) {
    'uploaded' => NoteProcessingStatus.uploading,
    'uploading' => NoteProcessingStatus.uploading,
    'transcribing' => NoteProcessingStatus.transcribing,
    'transcribed' => NoteProcessingStatus.generating,
    'generating' => NoteProcessingStatus.generating,
    'organizing' => NoteProcessingStatus.organizing,
    'ready' => NoteProcessingStatus.ready,
    'failed' => NoteProcessingStatus.failed,
    _ => NoteProcessingStatus.draft,
  };
}
