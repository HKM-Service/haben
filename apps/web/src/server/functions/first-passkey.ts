import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { isAPIError } from "better-auth/api";
import { auth } from "../auth.ts";
import { isFirstPasskeySession } from "../first-passkey-session.ts";
import { ssoOnly } from "../sso-policy.ts";

export const getFirstPasskeySetup = createServerFn({ method: "GET" }).handler(async () => {
  if (ssoOnly()) return false;
  try {
    const current = await auth().api.getSession({ headers: getRequestHeaders() });
    return current ? isFirstPasskeySession(current.session) : false;
  } catch (error) {
    if (isAPIError(error) && error.status === "UNAUTHORIZED") return false;
    throw error;
  }
});
