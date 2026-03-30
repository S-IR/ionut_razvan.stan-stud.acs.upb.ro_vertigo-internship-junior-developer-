import { Elysia, t } from "elysia";
// import { handleRegister, handleLogin } from "./handlers";
import { jwt } from "@elysiajs/jwt";
import { authMiddleware } from "../middleware/auth.middleware";
import { assert, assertUser } from "../lib/assert";
import { validateLogin, validateRegistration } from "../lib/validation";
import db from "../db";
import { hashPassword, verifyPassword } from "../lib/auth";
import { eq } from "drizzle-orm";
import { usersTable } from "../db/schema";

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(authMiddleware)
  .post(
    "/register",
    async (ctx) => {
      const {
        body,
        jwt,
        set,
        cookie: { auth_token },
      } = ctx;
      if (auth_token === undefined) throw new Error("auth token is undefined");
      const { username, email, password } = body;

      if (process.env.ENV === "DEV") {
        assert(typeof username === "string");
        assert(username !== "");
        assert(typeof email === "string");
        assert(email !== "");
        assert(typeof password === "string");
        assert(password !== "");
      }

      const errors = validateRegistration(username, email, password);

      if (errors.length > 0) {
        set.status = 400;
        return { errors };
      }
      const existingUser = await db.query.usersTable.findFirst({
        where: (users, { or, eq }) =>
          or(eq(users.email, email), eq(users.username, username)),
      });

      if (existingUser) {
        set.status = 409;
        return { errors: ["user with this email or username already exists"] };
      }

      const passwordHash = await hashPassword(password);

      const newUser = await db
        .insert(usersTable)
        .values({
          username,
          email,
          passwordHash,
          role: process.env.ENV === "DEV" ? "admin" : undefined,
        })
        .returning()!;
      assert(newUser.length > 0);

      if (process.env.ENV === "DEV") {
        assert(!!newUser[0]);
        assert(typeof newUser[0]!.id === "number");
        assert(newUser[0]!.id >= 0);
        assert(typeof newUser[0]!.username === "string");
        assert(newUser[0]!.username !== "");
        assert(typeof newUser[0]!.email === "string");
        assert(newUser[0]!.email !== "");
      }

      const token = await jwt.sign({ userId: newUser[0]!.id });

      if (process.env.ENV === "DEV") {
        assert(typeof token === "string");
        assert(token !== "");
      }

      auth_token.set({
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: AUTH_COOKIE_MAX_AGE,
        path: "/",
      });

      set.status = 201;
      return {
        id: newUser[0]!.id,
        username: newUser[0]!.username,
        email: newUser[0]!.email,
      };
    },
    {
      body: t.Object({
        username: t.String(),
        email: t.String(),
        password: t.String(),
      }),
    },
  )
  .post(
    "/login",
    async (ctx) => {
      const {
        body,
        jwt,
        set,
        cookie: { auth_token },
      } = ctx;
      if (auth_token === undefined) throw new Error("auth token is undefined");

      const { email, password } = body;

      if (process.env.ENV === "DEV") {
        assert(typeof email === "string");
        assert(email !== "");
        assert(typeof password === "string");
        assert(password !== "");
      }

      const errors = validateLogin(email, password);

      if (errors.length > 0) {
        set.status = 400;
        return { errors };
      }

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, email),
      });

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        set.status = 401;
        return { errors: ["Invalid email or password"] };
      }

      assertUser(user);

      const token = await jwt.sign({ userId: user.id });

      if (process.env.ENV === "DEV") {
        assert(typeof token === "string");
        assert(token !== "");
      }

      auth_token.set({
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: AUTH_COOKIE_MAX_AGE,
        path: "/",
      });

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        token,
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    },
  )
  .get("/me", ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { errors: ["Unauthorized"] };
    }
    assertUser(user);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  })
  .post("/logout", ({ cookie: { auth_token } }) => {
    auth_token.remove();
  });
