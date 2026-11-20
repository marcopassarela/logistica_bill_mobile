"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { PageTransition } from "./PageTransition";
import { useStartupTransition } from "./StartupTransitionProvider";
import { NotificationBell } from "./NotificationBell";
import { PushNotificationSetup } from "@/components/notifications/PushNotificationSetup";
import { RealtimeSync } from "@/components/realtime/RealtimeSync";
import { canAccess, firstAllowedPath, permissionFromPath, type PermissionMap } from "@/lib/permissions";
import { UserAccessProvider } from "./UserAccessContext";

interface DashboardShellProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  userPermissions: PermissionMap | null;
  funcionarioId: string | null;
}

export function DashboardShell({
  children,
  userName,
  userRole,
  userPermissions,
  funcionarioId,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { finishStartupTransition } = useStartupTransition();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("logisticas-bill-sidebar-collapsed") === "true");
    } catch {
      // O menu continua funcional mesmo se o armazenamento estiver indisponível.
    }
  }, []);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      finishStartupTransition();
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [finishStartupTransition]);


  useEffect(() => {
    const permission = permissionFromPath(pathname);
    if (!permission || canAccess(userRole, userPermissions, permission)) return;

    const allowedPath = firstAllowedPath(userRole, userPermissions);
    if (allowedPath === "/login") {
      void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.replace("/login");
      });
      return;
    }

    router.replace(allowedPath);
  }, [pathname, router, userRole, userPermissions]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          "logisticas-bill-sidebar-collapsed",
          String(next)
        );
      } catch {
        // A preferência fica apenas na sessão atual.
      }
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-background text-foreground"
    >
      <RealtimeSync />
      <Sidebar
        userName={userName}
        userRole={userRole}
        userPermissions={userPermissions}
        onLogout={handleLogout}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <div
        className={`min-h-screen transition-[padding] duration-200 ease-in-out ${
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
          <NotificationBell />
          <PushNotificationSetup />
          <ThemeToggle />
        </header>
        <main className="p-4 lg:p-6">
          <UserAccessProvider role={userRole} funcionarioId={funcionarioId} permissions={userPermissions}>
            <PageTransition>{children}</PageTransition>
          </UserAccessProvider>
        </main>
      </div>
    </motion.div>
  );
}
