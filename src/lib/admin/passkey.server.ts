import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import {
  getCookie,
  setCookie,
  deleteCookie,
} from "@tanstack/start-server-core/request-response";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { adminPasskey } from "@/db/schema";
import { requireAdmin } from "./auth";
import { createAdminSession } from "./auth.server";

const RP_ID = process.env["NODE_ENV"] === "production" ? "notteshe.com" : "localhost";
const RP_NAME = "Notteshe Admin";
const ORIGIN =
  process.env["NODE_ENV"] === "production"
    ? "https://notteshe.com"
    : "http://localhost:3000";

// ─── Registration ─────────────────────────────────────────────────────────────

export async function startPasskeyRegistration() {
  const admin = await requireAdmin();

  const existingKeys = await db()
    .select({ credentialId: adminPasskey.credentialId })
    .from(adminPasskey)
    .where(eq(adminPasskey.adminId, admin.id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: admin.email,
    userDisplayName: admin.name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existingKeys.map((k) => ({
      id: k.credentialId,
    })),
  });

  // Store challenge in a short-lived httpOnly cookie
  setCookie("passkey_reg_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 300, // 5 minutes
    secure: process.env["NODE_ENV"] === "production",
  });

  return options;
}

export async function finishPasskeyRegistration(
  response: RegistrationResponseJSON,
  deviceName: string
) {
  const admin = await requireAdmin();
  const expectedChallenge = getCookie("passkey_reg_challenge");
  if (!expectedChallenge) throw new Error("Challenge missing or expired");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  deleteCookie("passkey_reg_challenge", { path: "/" });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;

  await db().insert(adminPasskey).values({
    id: crypto.randomUUID(),
    adminId: admin.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    deviceName: deviceName.trim() || null,
  });
}

// ─── Authentication ───────────────────────────────────────────────────────────

export async function startPasskeyAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    // Empty = discoverable credentials: the device picks the right passkey
    allowCredentials: [],
  });

  setCookie("passkey_auth_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 300,
    secure: process.env["NODE_ENV"] === "production",
  });

  return options;
}

export async function finishPasskeyAuthentication(
  response: AuthenticationResponseJSON
): Promise<{ success: true } | { success: false; error: string }> {
  const expectedChallenge = getCookie("passkey_auth_challenge");
  if (!expectedChallenge) return { success: false, error: "Challenge missing or expired" };

  const [storedKey] = await db()
    .select()
    .from(adminPasskey)
    .where(eq(adminPasskey.credentialId, response.id))
    .limit(1);

  if (!storedKey) return { success: false, error: "Passkey not recognised" };

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: storedKey.credentialId,
        publicKey: Buffer.from(storedKey.publicKey, "base64url"),
        counter: storedKey.counter,
      },
    });
  } catch {
    deleteCookie("passkey_auth_challenge", { path: "/" });
    return { success: false, error: "Passkey verification failed" };
  }

  deleteCookie("passkey_auth_challenge", { path: "/" });

  if (!verification.verified) return { success: false, error: "Passkey verification failed" };

  // Update counter to prevent replay attacks
  await db()
    .update(adminPasskey)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(adminPasskey.credentialId, storedKey.credentialId));

  const token = await createAdminSession(storedKey.adminId);
  setCookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env["NODE_ENV"] === "production",
  });

  return { success: true };
}

// ─── Management ───────────────────────────────────────────────────────────────

export async function listPasskeys() {
  const admin = await requireAdmin();
  return db()
    .select({
      id: adminPasskey.id,
      credentialId: adminPasskey.credentialId,
      deviceName: adminPasskey.deviceName,
      createdAt: adminPasskey.createdAt,
    })
    .from(adminPasskey)
    .where(eq(adminPasskey.adminId, admin.id))
    .orderBy(adminPasskey.createdAt);
}

export async function deletePasskey(passkeyId: string) {
  const admin = await requireAdmin();
  await db()
    .delete(adminPasskey)
    .where(and(eq(adminPasskey.id, passkeyId), eq(adminPasskey.adminId, admin.id)));
}
