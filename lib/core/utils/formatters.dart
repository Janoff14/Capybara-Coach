import 'package:intl/intl.dart';

String formatElapsed(Duration duration) {
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');

  if (hours > 0) {
    return '${hours.toString().padLeft(2, '0')}:$minutes:$seconds';
  }

  return '$minutes:$seconds';
}

String formatDateTime(DateTime dateTime) {
  return DateFormat('MMM d, HH:mm').format(dateTime);
}
