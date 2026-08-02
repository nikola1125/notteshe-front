import { randomUUID } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { adminUser, adminSession } from "@/db/schema";
import type { AdminUser } from "@/db/schema";

// ─── Password hashing (Web Crypto, no native modules) ────────────────────────

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
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(bits);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(hashArray)
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
      {
        name: "PBKDF2",
        salt,
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    const candidate = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Constant-time comparison
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

// ─── Session management ───────────────────────────────────────────────────────

export async function createAdminSession(
  adminId: string,
  ip?: string
): Promise<string> {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db()
    .insert(adminSession)
    .values({
      id: randomUUID(),
      adminId,
      token,
      expiresAt,
      ipAddress: ip ?? null,
    });

  // Update last login
  await db()
    .update(adminUser)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUser.id, adminId));

  return token;
}

export async function getAdminSession(
  request: Request
): Promise<AdminUser | null> {
  try {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);

    const rows = await db()
      .select({ adminUser })
      .from(adminSession)
      .innerJoin(adminUser, eq(adminSession.adminId, adminUser.id))
      .where(
        and(
          eq(adminSession.token, token),
          gt(adminSession.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!rows[0]) return null;
    const admin = rows[0].adminUser;
    if (!admin.isActive) return null;
    return admin;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request): Promise<AdminUser> {
  const admin = await getAdminSession(request);
  if (!admin) throw new Error("ADMIN_UNAUTHORIZED");
  return admin;
}

export async function deleteAdminSession(token: string): Promise<void> {
  await db()
    .delete(adminSession)
    .where(eq(adminSession.token, token));
}
