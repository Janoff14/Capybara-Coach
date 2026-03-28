import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="font-display text-4xl font-bold tracking-[-0.05em] text-[var(--foreground)]">{value}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-soft)]">{hint}</p>
      </CardContent>
    </Card>
  );
}
