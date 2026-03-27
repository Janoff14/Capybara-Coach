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
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="font-display text-4xl font-semibold text-white">{value}</p>
        <p className="mt-2 text-sm text-slate-300">{hint}</p>
      </CardContent>
    </Card>
  );
}
