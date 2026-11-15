import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { signInEmailSchema } from "@/lib/sign-in-email";

import { sendSignInLink } from "./mailer";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  session: { expiresIn: 30 * 24 * 60 * 60, updateAge: 60 * 60 },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  telemetry: { enabled: false },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/magic-link") return;
      const parsed = signInEmailSchema.safeParse(ctx.body?.email);
      if (!parsed.success)
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_EMAIL",
          message: "Проверьте адрес почты",
        });
      const email = parsed.data;
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
        const cutoff = new Date(Date.now() - 10 * 60 * 1000);
        await tx
          .delete(schema.signInLinkRequests)
          .where(lt(schema.signInLinkRequests.createdAt, cutoff));
        const count = await tx.$count(
          schema.signInLinkRequests,
          and(
            eq(schema.signInLinkRequests.email, email),
            gte(schema.signInLinkRequests.createdAt, cutoff),
          ),
        );
        if (count >= 3)
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "TOO_MANY_REQUESTS",
            message: "Слишком часто, попробуйте через несколько минут",
          });
        await tx.insert(schema.signInLinkRequests).values({ email });
      });
      return { context: { body: { ...ctx.body, email } } };
    }),
  },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => sendSignInLink(email, url),
    }),
    nextCookies(),
  ],
});
