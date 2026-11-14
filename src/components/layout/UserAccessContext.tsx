"use client";

import { createContext, useContext } from "react";
import { canAccess, normalizePermissions, type PermissionMap } from "@/lib/permissions";

type UserAccess = {
  role: string;
  permissions: PermissionMap;
  can: (permission: string) => boolean;
};

const UserAccessContext = createContext<UserAccess | null>(null);

export function UserAccessProvider({ role, permissions, children }: { role: string; permissions: PermissionMap | null; children: React.ReactNode }) {
  const normalized = normalizePermissions(permissions);
  return (
    <UserAccessContext.Provider value={{ role, permissions: normalized, can: (permission) => canAccess(role, normalized, permission) }}>
      {children}
    </UserAccessContext.Provider>
  );
}

export function useUserAccess() {
  const value = useContext(UserAccessContext);
  if (!value) throw new Error("useUserAccess deve ser usado dentro de UserAccessProvider");
  return value;
}
