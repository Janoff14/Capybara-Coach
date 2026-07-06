type OperationProgressProps = {
  compact?: boolean;
  detail?: string;
  label: string;
  value?: number | null;
};

export function OperationProgress({
  compact = false,
  detail,
  label,
  value,
}: OperationProgressProps) {
  const determinate = typeof value === "number";
  const percent = determinate ? Math.min(100, Math.max(0, Math.round(value))) : null;

  return (
    <div
      className={`operation-progress${compact ? " is-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="operation-progress-heading">
        <strong>{label}</strong>
        {percent !== null ? <span>{percent}%</span> : <span>Working…</span>}
      </div>
      <div
        className={`operation-progress-track${determinate ? "" : " is-indeterminate"}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={percent ?? undefined}
      >
        <i style={determinate ? { width: `${percent}%` } : undefined} />
      </div>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}
