import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
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
    requireEmailVerification: false, // enable once Resend is wired
  },

  socialProviders: {
    google: {
      clientId: process.env["GOOGLE_CLIENT_ID"]!,
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,        // 30 days
    updateAge: 60 * 60 * 24,              // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                     // 5 min client-side cache
    },
  },

  trustedOrigins: [
    process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  ],
});

export type Auth = typeof auth;
