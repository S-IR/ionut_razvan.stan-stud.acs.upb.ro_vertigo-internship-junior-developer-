import { Elysia, t } from "elysia";
import { getUserById } from "../lib/auth";
import { usersTable } from "../db/schema";
import { eq } from "drizzle-orm";
import db from "../db";
import jwt from "@elysiajs/jwt";

// auth.middleware.ts - just reads the cookie, no schema needed here
export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
  .guard({
    cookie: t.Cookie({
      auth_token: t.Optional(t.String()),
    }),
  })
  .derive(async ({ jwt, cookie: { auth_token } }) => {

    if (!auth_token.value) return { user: null };

    const payload = await jwt.verify(auth_token.value); // 
    if (!payload) return { user: null };

    const user = await getUserById(payload.userId as number);
    return { user };
  }).as("scoped")

export const requireAuth = new Elysia()
  .use(authMiddleware)
  .onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { errors: ["Unauthorized"] };
    }
  });
