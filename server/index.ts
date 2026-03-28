import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./src/api/auth.routes";
import { marketRoutes } from "./src/api/markets.routes";
import { jwtPlugin } from "./src/plugins/jwt";
import { usersRoutes } from "./src/api/users.routes";
import cron from "node-cron";
import db from "./src/db";
import { apiKeysTable } from "./src/db/schema";
import { lt } from "drizzle-orm";
const PORT = Number(process.env.PORT || 4001);
const HOST = process.env.HOST || "0.0.0.0";

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(jwtPlugin)
  .onError(({ code, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { errors: ["Not found"] };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { errors: ["Invalid request"] };
    }
  })
  .use(authRoutes)
  .use(marketRoutes)
  .use(usersRoutes);

if (import.meta.main) {
  app.listen({
    port: PORT,
    hostname: HOST,
  });
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
}
cron.schedule("0 * * * *", async () => {
  const now = new Date();
  await db
    .delete(apiKeysTable)
    .where(lt(apiKeysTable.expiresAt, now));

});