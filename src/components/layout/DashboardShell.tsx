"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

interface DashboardShellProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
}

export function DashboardShell({
  children,
  userName,
}: DashboardShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("logisticas-bill-sidebar-collapsed") === "true");
    } catch {
      // O menu continua funcional mesmo se o armazenamento estiver indisponível.
    }
  }, []);

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
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        userName={userName}
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
          <ThemeToggle />
        </header>
        <main className="animate-fade-in p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}