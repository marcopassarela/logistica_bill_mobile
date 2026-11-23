import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { canAccess, firstAllowedPath, permissionFromPath } from "@/lib/permissions";

const COOKIE_NAME = "lb_session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const basePermission = permissionFromPath(pathname.replace(/^\/api\//, "/"));
  if (!basePermission || pathname === "/api/auth/login" || pathname === "/api/auth/logout" || pathname === "/api/auth/heartbeat" || pathname === "/api/health/database" || pathname === "/api/users") return NextResponse.next();
  const detalheCarregamento = /^\/api\/carregamentos\/[^/]+$/.test(pathname);
  // A API individual valida no corpo se o PATCH é status ou edição completa.
  // Não exigir "editar" aqui evita bloquear quem recebeu somente alterarStatus.
  const action = request.method === "POST" ? "criar" : request.method === "PATCH" && !detalheCarregamento ? "editar" : request.method === "DELETE" ? "excluir" : "visualizar";
  const permission = basePermission.replace(/\.visualizar$/, `.${action}`);

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET não configurado");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    const role = String(payload.role || "USER");
    if (!canAccess(role, payload.permissions, permission)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Você não tem permissão para acessar este recurso." }, { status: 403 });
      return NextResponse.redirect(new URL(firstAllowedPath(role, payload.permissions), request.url));
    }
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest).*)"],
};
