import { Elysia, t } from "elysia";
import { getUserById } from "../lib/auth";
import { apiKeysTable } from "../db/schema";
import { eq } from "drizzle-orm";
import db from "../db";
import jwt from "@elysiajs/jwt";
import { hashApiKey } from "../lib/apiKeys";
import { assert } from "../lib/assert";

// auth.middleware.ts - just reads the cookie, no schema needed here
export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
  .guard({
    cookie: t.Cookie({
      auth_token: t.Optional(t.String()),
    }),
  })
  .derive(async ({ jwt, cookie, request }) => {
    if (!cookie || !cookie.auth_token || !cookie.auth_token.value) {
      const authHeader = request.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) return { user: null };
      const raw = authHeader.slice("Bearer ".length);
      const hash = hashApiKey(raw);
      const keyRow = await db.query.apiKeysTable.findFirst({
        where: eq(apiKeysTable.keyHash, hash),
        with: { user: true },
      });
      if (!keyRow) return { user: null };

      db.update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, keyRow.id))
        .run();
      return { user: keyRow.user };
    }
    assert(cookie && cookie.auth_token && cookie.auth_token.value);
    const authTokenValue = cookie.auth_token.value;
    const payload = await jwt.verify(authTokenValue); //
    if (!payload) return { user: null };

    const user = await getUserById(payload.userId as number);
    return { user };
  })
  .as("scoped");

export const requireAuth = new Elysia()
  .use(authMiddleware)
  .onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { errors: ["Unauthorized"] };
    }
  });
