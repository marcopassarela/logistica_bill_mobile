import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell userName={user.name} userRole={user.role} userPermissions={user.permissions as import("@/lib/permissions").PermissionMap | null}>
      {children}
    </DashboardShell>
  );
}
