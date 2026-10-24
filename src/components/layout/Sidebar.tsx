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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useState } from "react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/carregamentos", label: "Carregamentos", icon: PackageCheck },
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
}

export function Sidebar({ userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-foreground/10 px-4">
        <Logo className="h-10 w-10 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm leading-tight truncate">
            Logísticas Bill
          </span>
          <span className="text-xs text-muted-foreground">Controle Operacional</span>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-sidebar-foreground/10 p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-foreground/5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">Logado</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Sair"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ x: mobileOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground shadow-xl lg:hidden"
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-3"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
        {content}
      </motion.aside>

      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col bg-sidebar text-sidebar-foreground border-r">
        {content}
      </aside>
    </>
  );
}
