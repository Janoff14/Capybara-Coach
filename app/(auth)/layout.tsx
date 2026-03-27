import { PublicOnly } from "@/components/app/route-gates";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicOnly>{children}</PublicOnly>;
}
