import { Elysia, t } from "elysia";

import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import { betsTable, marketsTable, usersTable } from "../db/schema";
import db from "../db";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { PAGE_LIMIT } from "./handlers";
import { assertUser } from "../lib/assert";

export const usersRoutes = new Elysia({ prefix: "/api/users" })
    .use(authMiddleware)
    .get("/leaderboards", getLeaderboardsOfUser as any, {
        query: t.Object({
            page: t.Numeric({ minimum: 0, default: 0 }),
        }),
    })
    .use(requireAuth)
    .get("/bets/:id", getBetsOfUser as any)

async function getBetsOfUser(ctx: { id: { params: { id: string } }, user: typeof usersTable.$inferSelect }) {


    const { user } = ctx
    assertUser(user)
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
async function getLeaderboardsOfUser(ctx: { query: { page: number } }) {
    console.assert(ctx.query.page >= 0)
    const page = ctx.query.page;

    const baseQuery = db
        .select({
            id: usersTable.id,
            username: usersTable.username,
            totalWinnings: sum(betsTable.amount).as('totalWinnings'),
        })
        .from(betsTable)
        .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .where(
            and(
                eq(marketsTable.status, "resolved"),
                eq(betsTable.outcomeId, marketsTable.resolvedOutcomeId)
            )
        )
        .groupBy(usersTable.id);

    const leaderboard = baseQuery.as("leaderboard");

    const topUsers = await db
        .select()
        .from(leaderboard)
        .orderBy(desc(leaderboard.totalWinnings))
        .limit(PAGE_LIMIT)
        .offset(page * PAGE_LIMIT);

    const result = await db
        .select({ total: count() })
        .from(leaderboard);

    const total = result[0]?.total ?? 0;
    const totalPages = Math.ceil(total / PAGE_LIMIT)
    if (process.env.ENV === "DEV") {
        console.assert(!Number.isNaN(totalPages))
        console.assert(totalPages >= 0)

        for (const user of topUsers) {
            console.assert(!!user)
            console.assert(typeof user.id === "number")
            console.assert(user.id >= 0)

            console.assert(typeof user.username === "string")
            console.assert(user.username !== "")


            console.assert(typeof user.totalWinnings === "string" || user.totalWinnings === null)
            if (user.totalWinnings !== null) {
                console.assert(user.totalWinnings !== "")
            }
        }
    }

    return { topUsers, totalPages };

}
