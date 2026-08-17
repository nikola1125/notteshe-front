import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRuntimeEnv } from "@/lib/runtime-env";

// Lazy singleton — not initialized at module load time so process.env is
// populated from Cloudflare bindings before db() reads DATABASE_URL
// typed as the betterAuth return so the singleton is usable; the options
// shape is inferred from the call below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: ReturnType<typeof betterAuth<any>> | undefined;

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

      // Block enforcement: checked at session update (re-login), not at create.
      // Checking at create interfered with brand-new signups — the hook fires
      // for both signup and login, and any DB hiccup would wrongly block new users.
      databaseHooks: {
        session: {
          update: {
            before: async (session) => {
              try {
                const { APIError } = await import("better-auth");
                const rows = await db()
                  .select({ blocked: schema.user.blocked })
                  .from(schema.user)
                  .where(eq(schema.user.id, session.userId))
                  .limit(1);
                if (rows[0]?.blocked === true) {
                  throw new APIError("FORBIDDEN", {
                    message: "Your account has been suspended. Please contact support.",
                  });
                }
              } catch (err: unknown) {
                // Re-throw only our own APIError; swallow unexpected DB errors
                // so a transient Neon hiccup never blocks legitimate users.
                if ((err as { status?: number })?.status === 403) throw err;
              }
              return { data: session };
            },
          },
        },
      },

      socialProviders: {
        google: {
          clientId: getRuntimeEnv("GOOGLE_CLIENT_ID")!,
          clientSecret: getRuntimeEnv("GOOGLE_CLIENT_SECRET")!,
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
        getRuntimeEnv("BETTER_AUTH_URL") ?? "http://localhost:8080",
      ],
    });
  }
  // _auth is always set by the branch above
  return _auth!;
}

export const auth = {
  handler: (req: Request) => getAuth().handler(req),
  get api() { return getAuth().api; },
};

export type Auth = ReturnType<typeof getAuth>;
