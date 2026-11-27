import { APIError } from "better-auth";
import { createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { runLocalAuth } from "./auth-transaction.ts";
import { withActor } from "./db/actor.ts";
import { env } from "./env.ts";
import { claimFirstPasskeyCode } from "./first-passkey-code.ts";
import { markFirstPasskeySession } from "./first-passkey-session.ts";

/** Bestehende Better-Auth-Sitzungshooks prüfen Sperre/Rolle und schreiben den Anmeldenachweis. */
export const firstPasskeyCodePlugin = () => ({
  id: "first-passkey-code",
  endpoints: {
    signInFirstPasskeyCode: createAuthEndpoint(
      "/sign-in/first-passkey-code",
      {
        method: "POST",
        // Wie /sign-in/email: auch der erste Aufruf OHNE Cookie muss fremde Origins abweisen.
        use: [formCsrfMiddleware],
        body: z
          .object({
            code: z
              .string()
              .trim()
              .regex(/^[A-Za-z0-9_-]{43}$/),
          })
          .strict(),
      },
      async (ctx) => {
        // formCsrfMiddleware überspringt JSON-Anfragen. Für diesen Erstlogin ist die feste Origin auch ohne Cookie Pflicht.
        if (ctx.headers?.get("origin") !== new URL(env().BETTER_AUTH_URL).origin) {
          throw new APIError("FORBIDDEN", { message: "Die Anmeldung ist nur über diese Haben-Adresse möglich." });
        }
        const authenticated = await withActor("system:passkey-einmalcode", (tx) =>
          runLocalAuth(tx, async () => {
            const user = await claimFirstPasskeyCode(tx, ctx.body.code);
            if (!user) return null;
            const session = await ctx.context.internalAdapter.createSession(user.id);
            if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Die Anmeldung ist vorübergehend nicht verfügbar." });
            await markFirstPasskeySession(tx, session);
            return { user, session };
          }),
        );
        if (!authenticated) throw new APIError("BAD_REQUEST", { message: "Der Einmalcode ist ungültig, abgelaufen oder bereits verwendet." });
        // Erst nach erfolgreichem Commit darf ein Sitzungscookie den Browser erreichen.
        await setSessionCookie(ctx, authenticated);
        ctx.setHeader("cache-control", "no-store");
        return ctx.json({ success: true });
      },
    ),
  },
});
