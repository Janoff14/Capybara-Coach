import '../../domain/models/app_user.dart';
import '../../domain/services/auth_service.dart';

class MockAuthService implements AuthService {
  const MockAuthService({
    required AppUser seedUser,
  }) : _seedUser = seedUser;

  final AppUser _seedUser;

  @override
  Future<AppUser> initializeSession() async => _seedUser;

  @override
  Stream<AppUser?> watchUser() => Stream.value(_seedUser);
}
