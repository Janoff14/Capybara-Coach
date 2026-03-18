import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/models/app_user.dart';
import '../../domain/models/captured_audio.dart';
import '../../domain/models/folder_entity.dart';
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

    final streamedResponse = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    _throwIfNotSuccessful(response);

    final payload = _decodeObject(response.body);
    return SubmittedVoiceUpload(
      uploadId: payload['upload_id'] as String? ?? '',
      noteId: payload['note_id'] as String? ?? '',
      status: _mapNoteStatus(payload['status'] as String?),
    );
  }

  Future<StudyNote> fetchNote({
    required AppUser user,
    required String noteId,
  }) async {
    final response = await _httpClient.get(_resolveUri('notes/$noteId'));
    _throwIfNotSuccessful(response);
    final payload = _decodeObject(response.body);
    return _mapNote(payload, fallbackUserId: user.id);
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
        .map((item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ))
        .toList();
  }

  StudyNote _mapNote(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
  }) {
    final cleanedContent =
        payload['cleaned_content'] as String? ??
        payload['raw_transcript'] as String? ??
        'Your structured note is still being prepared.';
    final summary =
        payload['summary'] as String? ??
        'Capybara Coach is preparing this note.';
    final folderId = payload['folder_id'] as String?;
    final tags = _toStringList(payload['tags']);
    final keyTerms = _toStringList(payload['key_terms']);
    final suggestedFolder = payload['suggested_folder'] as String?;
    final topics = {
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
      sourceDuration: Duration.zero,
    );
  }

  StudyNote _mapNoteListItem(
    Map<String, dynamic> payload, {
    required String fallbackUserId,
  }) {
    final summary =
        payload['summary'] as String? ?? 'Open this note to review the content.';
    final title = payload['title'] as String? ?? 'Untitled note';
    final updatedAt = _parseDateTime(payload['updated_at']);
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
        if (folderTitle != null && folderTitle.trim().isNotEmpty) folderTitle.trim(),
      ],
      relatedNoteIds: const <String>[],
      aiProcessingStatus: _mapNoteStatus(payload['processing_status'] as String?),
      createdAt: _parseDateTime(payload['created_at']),
      updatedAt: updatedAt,
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
