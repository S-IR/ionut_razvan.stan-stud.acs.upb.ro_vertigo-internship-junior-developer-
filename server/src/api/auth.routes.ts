import { Elysia, t } from "elysia";
import { handleRegister, handleLogin } from "./handlers";
import { jwt } from "@elysiajs/jwt";
import { authMiddleware } from "../middleware/auth.middleware";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(authMiddleware)
  .post("/register", handleRegister as any, {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/login", handleLogin as any, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .get("/me", ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { errors: ["Unauthorized"] };
    }
    return user;
  })
  .post("/logout", ({ cookie: { auth_token } }) => {
    auth_token.remove();
    return { ok: true };
  });
