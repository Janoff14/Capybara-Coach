"use client";

const BAR_FACTORS = [0.55, 0.85, 1.2, 0.7, 1.45, 0.95, 1.6, 1.05, 1.25, 0.72, 1.38, 0.88];

export function VoiceWaveform({
  audioLevel,
  hasSpoken,
  isRecording,
}: {
  audioLevel: number;
  hasSpoken: boolean;
  isRecording: boolean;
}) {
  const intensity = isRecording ? Math.max(0.14, Math.min(1, audioLevel * 24)) : 0.1;

  return (
    <div className="flex h-28 items-end justify-center gap-2 rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-5 py-5 shadow-[var(--shadow-soft)]">
      {BAR_FACTORS.map((factor, index) => {
        const height = Math.max(
          14,
          Math.min(
            86,
            14 + Math.round((hasSpoken ? 56 : 28) * intensity * factor),
          ),
        );

        return (
          <span
            key={`wave-${index}`}
            className="w-3 rounded-full bg-[linear-gradient(180deg,var(--primary-soft),var(--primary))] transition-[height,opacity,transform] duration-200"
            style={{
              height,
              opacity: isRecording ? 1 : 0.45,
              transform: isRecording ? "scaleY(1)" : "scaleY(0.92)",
            }}
          />
        );
      })}
    </div>
  );
}
