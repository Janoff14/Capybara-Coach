class NoteLinkEntity {
  const NoteLinkEntity({
    required this.id,
    required this.userId,
    required this.fromNoteId,
    required this.toNoteId,
    required this.relationType,
    required this.score,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String fromNoteId;
  final String toNoteId;
  final String relationType;
  final double score;
  final DateTime createdAt;
}
