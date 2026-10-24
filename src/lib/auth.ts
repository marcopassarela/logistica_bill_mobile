import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-me-in-production-min-32-chars!!"
);

const COOKIE_NAME = "lb_session";
const SESSION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const jwt = await new SignJWT({ sub: userId, sid: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return jwt;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(COOKIE_NAME)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, JWT_SECRET);
      const sid = payload.sid as string;
      if (sid) {
        await prisma.session.deleteMany({ where: { token: sid } });
      }
    } catch {
      // ignore
    }
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(COOKIE_NAME)?.value;
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, JWT_SECRET);
    const userId = payload.sub as string;
    const sid = payload.sid as string;

    const session = await prisma.session.findUnique({
      where: { token: sid },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            theme: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
  });
  if (!admin) return false;
  return verifyPassword(admin.passwordHash, password);
}
