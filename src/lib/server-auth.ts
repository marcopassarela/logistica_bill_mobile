import "server-only";
import { cookies } from "next/headers";
import type { PermissionMap } from "@/lib/permissions";

export type ServerUser = {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  permissions: PermissionMap | null;
  funcionarioId: string | null;
};

export async function getServerUser(): Promise<ServerUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("lb_session")?.value;
  if (!sessionToken) return null;

  try {
    const response = await fetch("https://logisticas-bill-backend.onrender.com/api/auth/profile", {
      headers: { Cookie: `lb_session=${sessionToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as ServerUser;
  } catch {
    return null;
  }
}
