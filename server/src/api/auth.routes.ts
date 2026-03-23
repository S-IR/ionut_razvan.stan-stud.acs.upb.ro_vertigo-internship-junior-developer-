import { Elysia, t } from "elysia";
import { handleRegister, handleLogin } from "./handlers";
import { jwt } from "@elysiajs/jwt";

export const authRoutes = new Elysia({ prefix: "/api/auth" })

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
  });
