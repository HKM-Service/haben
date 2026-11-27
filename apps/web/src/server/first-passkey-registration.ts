import { APIError } from "better-auth";
import { eq } from "drizzle-orm";
import type { auth } from "./auth.ts";
import { runLocalAuth } from "./auth-transaction.ts";
import { withActor } from "./db/actor.ts";
import { schema } from "./db/index.ts";
import { revokeFirstPasskeyCodes } from "./first-passkey-code.ts";
import { clearFirstPasskeySessions } from "./first-passkey-session.ts";

/** Passkey und Widerruf offener Einmalcodes werden unter derselben Kontosperre gemeinsam festgeschrieben. */
export async function firstPasskeyRegistrationRequest(authentication: ReturnType<typeof auth>, request: Request): Promise<Response> {
  try {
    const current = await authentication.api.getSession({ headers: request.headers, query: { disableCookieCache: true, disableRefresh: true } });
    if (!current) return Response.json({ message: "Bitte erneut anmelden." }, { status: 401 });
    return await withActor(current.user.id, async (tx) => {
      await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, current.user.id)).for("update");
      const response = await runLocalAuth(tx, () => authentication.handler(request));
      if (!response.ok) throw response;
      await revokeFirstPasskeyCodes(tx, current.user.id);
      await clearFirstPasskeySessions(tx, current.user.id);
      return response;
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof APIError && error.statusCode < 500) return Response.json(error.body, { status: error.statusCode });
    throw error;
  }
}
