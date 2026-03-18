import 'package:flutter_test/flutter_test.dart';

import 'package:dicta_coach/core/utils/formatters.dart';

void main() {
  test('formatElapsed renders mm:ss for short recordings', () {
    expect(formatElapsed(const Duration(seconds: 7)), '00:07');
    expect(formatElapsed(const Duration(minutes: 2, seconds: 9)), '02:09');
  });

  test('formatElapsed renders hh:mm:ss for long recordings', () {
    expect(
      formatElapsed(const Duration(hours: 1, minutes: 3, seconds: 4)),
      '01:03:04',
    );
  });
}
