import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Lazy singleton — not initialized at module load time so process.env is
// populated from Cloudflare bindings before db() reads DATABASE_URL
let _auth: ReturnType<typeof betterAuth> | undefined;

function getAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: drizzleAdapter(db(), {
        provider: "pg",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },

      socialProviders: {
        google: {
          clientId: process.env["GOOGLE_CLIENT_ID"]!,
          clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
        },
      },

      session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        cookieCache: {
          enabled: true,
          maxAge: 60 * 5,
        },
      },

      trustedOrigins: [
        process.env["BETTER_AUTH_URL"] ?? "http://localhost:8080",
      ],
    });
  }
  return _auth;
}

export const auth = {
  handler: (req: Request) => getAuth().handler(req),
};

export type Auth = ReturnType<typeof getAuth>;
