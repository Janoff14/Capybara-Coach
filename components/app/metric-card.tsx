import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
  tone = "primary",
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "primary" | "secondary" | "tertiary" | "danger";
  icon?: React.ReactNode;
}) {
  const toneClasses = {
    primary: "text-[var(--primary)] bg-[rgba(75,102,72,0.06)]",
    secondary: "text-[var(--secondary)] bg-[rgba(82,97,112,0.08)]",
    tertiary: "text-[var(--tertiary)] bg-[rgba(116,91,59,0.08)]",
    danger: "text-[var(--danger)] bg-[rgba(167,59,33,0.08)]",
  }[tone];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {label}
          </p>
          {icon ? (
            <span className={`inline-flex rounded-2xl p-2 ${toneClasses}`}>{icon}</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-display text-4xl font-bold tracking-[-0.05em] text-[var(--foreground)]">
          {value}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-soft)]">{hint}</p>
      </CardContent>
    </Card>
  );
}
