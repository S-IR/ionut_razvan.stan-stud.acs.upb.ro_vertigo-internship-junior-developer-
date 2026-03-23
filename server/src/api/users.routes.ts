import Elysia from "elysia";
import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import { betsTable, marketsTable, usersTable } from "../db/schema";
import db from "../db";
import { eq } from "drizzle-orm";

export const usersRoutes = new Elysia({ prefix: "/api/users" })
    .use(authMiddleware)
    .use(requireAuth)
    .get("/bets/:id", getBetsOfUser as any)
async function getBetsOfUser(ctx: { id: { params: { id: string } }, user: typeof usersTable.$inferSelect }) {
    const { user } = ctx
    const bets = await db.query.betsTable.findMany({
        where: eq(betsTable.userId, user.id),
        with: {
            market: {
                columns: {
                    id: true,
                    title: true,
                    status: true,
                    resolvedOutcomeId: true,
                },
            },
            outcome: {
                columns: {
                    id: true,
                    title: true,
                },
            },
        },
    });

    return bets;
}