"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Truck,
  Users,
  Package,
  CalendarDays,
  UserX,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  PackageCheck,
  CalendarClock,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useState } from "react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/carregamentos", label: "Carregamentos", icon: PackageCheck },
  { href: "/programacoes", label: "Programações", icon: CalendarClock },
  { href: "/rotas", label: "Rotas", icon: Map },
  { href: "/caminhoes", label: "Caminhões", icon: Truck },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/diarias", label: "Diárias", icon: CalendarDays },
  { href: "/faltas", label: "Faltas", icon: UserX },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  userName: string;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({
  userName,
  onLogout,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function renderContent(isCollapsed: boolean, isMobile = false) {
    return (
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-foreground/10",
            isCollapsed ? "justify-center px-2" : "gap-3 px-4"
          )}
        >
          <Logo className="h-10 w-10 shrink-0" />
          {!isCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold leading-tight">
                Logísticas Bill
              </span>
              <span className="text-xs text-muted-foreground">
                Controle Operacional
              </span>
            </div>
          )}

          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileOpen(false)}
              title="Fechar menu"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            !isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onToggleCollapsed}
                title="Recolher menu"
                aria-label="Recolher menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )
          )}
        </div>

        {isCollapsed && !isMobile && (
          <div className="flex justify-center border-b border-sidebar-foreground/10 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              title="Expandir menu"
              aria-label="Expandir menu"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto py-3",
            isCollapsed ? "px-2" : "px-3"
          )}
          aria-label="Menu principal"
        >
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed && !isMobile ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-lg text-sm font-medium transition-colors",
                  isCollapsed
                    ? "justify-center px-2"
                    : "gap-3 px-3",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-sidebar-foreground/10 p-3">
          <div
            className={cn(
              "flex items-center rounded-lg bg-sidebar-foreground/5",
              isCollapsed
                ? "justify-center"
                : "justify-between gap-2 px-3 py-2"
            )}
          >
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">Logado</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
        title="Abrir menu"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <motion.aside
        initial={false}
        animate={{ x: mobileOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar text-sidebar-foreground shadow-xl lg:hidden"
        aria-label="Menu móvel"
      >
        {renderContent(false, true)}
      </motion.aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64"
        )}
        aria-label="Menu principal"
      >
        {renderContent(collapsed)}
      </aside>
    </>
  );
}
