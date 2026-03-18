import '../models/app_user.dart';

abstract class AuthService {
  Future<AppUser> initializeSession();

  Stream<AppUser?> watchUser();
}
