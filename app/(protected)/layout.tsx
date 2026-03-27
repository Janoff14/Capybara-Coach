import { AppShell } from "@/components/app/app-shell";
import { ProtectedArea } from "@/components/app/route-gates";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedArea>
      <AppShell>{children}</AppShell>
    </ProtectedArea>
  );
}
