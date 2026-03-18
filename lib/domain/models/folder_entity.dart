class FolderEntity {
  const FolderEntity({
    required this.id,
    required this.userId,
    required this.title,
    required this.description,
    required this.parentFolderId,
    required this.createdAt,
    required this.updatedAt,
    required this.aiGenerated,
  });

  final String id;
  final String userId;
  final String title;
  final String description;
  final String? parentFolderId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool aiGenerated;

  FolderEntity copyWith({
    String? id,
    String? userId,
    String? title,
    String? description,
    String? parentFolderId,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? aiGenerated,
    bool clearParentFolderId = false,
  }) {
    return FolderEntity(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      description: description ?? this.description,
      parentFolderId: clearParentFolderId
          ? null
          : parentFolderId ?? this.parentFolderId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      aiGenerated: aiGenerated ?? this.aiGenerated,
    );
  }
}
