import { eq, and, gt } from "drizzle-orm";
import {
  setCookie,
  deleteCookie,
  getCookie,
} from "@tanstack/start-server-core/request-response";
import { db } from "@/db";
import { adminUser, adminSession } from "@/db/schema";
import type { AdminUser } from "@/db/schema";

// ─── Password hashing (Web Crypto — works in Node + Cloudflare Workers) ───────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const candidate = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (candidate.length !== hashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ─── In-memory session cache (per worker instance, 60s TTL) ──────────────────
// Eliminates repeated DB roundtrips for auth on every server function call.

const _sessionCache = new Map<string, { admin: AdminUser; exp: number }>();

function cacheGet(token: string): AdminUser | null {
  const hit = _sessionCache.get(token);
  if (!hit) return null;
  if (hit.exp < Date.now()) { _sessionCache.delete(token); return null; }
  return hit.admin;
}

function cacheSet(token: string, admin: AdminUser) {
  _sessionCache.set(token, { admin, exp: Date.now() + 60_000 });
}

function cacheDel(token: string) {
  _sessionCache.delete(token);
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createAdminSession(adminId: string): Promise<string> {
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db().insert(adminSession).values({
    id: crypto.randomUUID(),
    adminId,
    token,
    expiresAt,
    ipAddress: null,
  });

  await db()
    .update(adminUser)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUser.id, adminId));

  return token;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  try {
    const token = getCookie("admin_token");
    if (!token) return null;

    const cached = cacheGet(token);
    if (cached) return cached;

    const rows = await db()
      .select({ adminUser })
      .from(adminSession)
      .innerJoin(adminUser, eq(adminSession.adminId, adminUser.id))
      .where(
        and(eq(adminSession.token, token), gt(adminSession.expiresAt, new Date()))
      )
      .limit(1);

    if (!rows[0]) return null;
    const admin = rows[0].adminUser;
    if (!admin.isActive) return null;

    cacheSet(token, admin);
    return admin;
  } catch {
    return null;
  }
}

export async function deleteAdminSession(token: string): Promise<void> {
  cacheDel(token);
  await db().delete(adminSession).where(eq(adminSession.token, token));
}

// ─── Compound actions (called from server function handlers) ──────────────────

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ success: true } | { success: false; error: string }> {
  const rows = await db()
    .select()
    .from(adminUser)
    .where(eq(adminUser.email, email.toLowerCase().trim()))
    .limit(1);

  const admin = rows[0];
  if (!admin || !admin.isActive) {
    return { success: false, error: "Invalid credentials" };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return { success: false, error: "Invalid credentials" };
  }

  const token = await createAdminSession(admin.id);

  setCookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env["NODE_ENV"] === "production",
  });

  return { success: true };
}

export async function logoutAdmin(): Promise<void> {
  const token = getCookie("admin_token");
  if (token) {
    await deleteAdminSession(token).catch(() => {});
  }
  deleteCookie("admin_token", { path: "/" });
}
