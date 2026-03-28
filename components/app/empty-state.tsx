import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="max-w-xl text-base leading-7">{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent className="pt-1">{action}</CardContent> : null}
    </Card>
  );
}
