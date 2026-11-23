import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      userName={user.name}
      clientId={user.id}
      sessionId={user.sessionId}
      userRole={user.role}
      userPermissions={user.permissions}
      funcionarioId={user.funcionarioId}
    >
      {children}
    </DashboardShell>
  );
}
