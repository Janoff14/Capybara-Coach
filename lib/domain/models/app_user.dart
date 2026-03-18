enum PlanTier {
  free,
  pro;

  String get label => switch (this) {
        PlanTier.free => 'Free',
        PlanTier.pro => 'Pro',
      };
}

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.createdAt,
    required this.planTier,
  });

  final String id;
  final String email;
  final String displayName;
  final DateTime createdAt;
  final PlanTier planTier;
}
