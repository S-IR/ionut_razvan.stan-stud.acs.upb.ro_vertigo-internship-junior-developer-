import { Elysia, t } from "elysia";

import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import { apiKeysTable, betsTable, marketOutcomesTable, marketsTable, usersTable } from "../db/schema";
import db from "../db";
import { and, count, countDistinct, desc, eq, ne, sum } from "drizzle-orm";
import { PAGE_LIMIT } from "./markets.routes";
import { assert, assertAPIKey, assertBet, assertUser } from "../lib/assert";
import type { ServerWebSocket } from "bun";
import { LISTEN_TO_ALL_SSE_ID } from "./markets.routes";
import { getUserById } from "../lib/auth";
import { generateApiKey } from "../lib/apiKeys";
import * as schema from "../db/schema";
import { sse } from 'elysia'
import { calculateOdds } from "./helpers";

type Listener = (data: any) => void;
const userListeners = new Map<number, Set<Listener>>();

function subscribeUser(id: number, fn: Listener) {
    if (!userListeners.has(id)) {
        userListeners.set(id, new Set());
    }
    userListeners.get(id)!.add(fn);

    return () => {
        const set = userListeners.get(id);
        if (!set) return;
        set.delete(fn);
        if (set.size === 0) {
            userListeners.delete(id);
        }
    };
}

function publishUser(id: number, payload: any) {
    userListeners.get(id)?.forEach(fn => fn(payload));
}

export function broadcastUserProfileUpdate(userID: number) {
    publishUser(userID, { type: WSUserUpdates.UserUpdated, userID });
}

export function broadcastNewBet(userID: number) {
    const payload = { type: WSUserUpdates.NewBet, userID };
    publishUser(userID, payload);
    publishUser(LISTEN_TO_ALL_SSE_ID, payload);
}

enum WSUserUpdates {
    UserUpdated = "user-updated",
    NewBet = "bet-new"
}
// --------------------------------------------------------------

export const BET_STATUSES = ["ongoing", "won", "lost"] as const

export const usersRoutes = new Elysia({ prefix: "/api/users" })
    .use(authMiddleware)
    .get("/leaderboards", async (ctx) => {
        assert(ctx.query.page >= 0)
        const page = ctx.query.page;

        const baseQuery = db
            .select({
                id: usersTable.id,
                username: usersTable.username,
                totalWinnings: sum(betsTable.winnings).as('totalWinnings'),
            })
            .from(betsTable)
            .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
            .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
            .where(
                and(
                    eq(marketsTable.status, "resolved"),
                    eq(betsTable.outcomeId, marketsTable.resolvedOutcomeId),
                )
            )
            .groupBy(usersTable.id);

        const leaderboard = baseQuery.as("leaderboard");

        const topUsersDB = await db
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

        const topUsers = topUsersDB.map((user) => {
            return { ...user, totalWinnings: user.totalWinnings ? parseFloat(user.totalWinnings) : null }
        })
        if (process.env.ENV === "DEV") {
            assert(!Number.isNaN(totalPages))
            assert(totalPages >= 0)

            for (const user of topUsers) {
                assert(!!user)
                assert(typeof user.id === "number")
                assert(user.id >= 0)

                assert(typeof user.username === "string")
                assert(user.username !== "")

                assert(user.totalWinnings === null || typeof user.totalWinnings === "number")
                assert(user.totalWinnings === null || user.totalWinnings >= 0)
            }
        }

        return { topUsers: topUsersDB, totalPages };
    }

        , {
            query: t.Object({
                page: t.Numeric({ minimum: 0, default: 0 }),
            }),
        })
    // .use(requireAuth)
    .get("/:id", async ({ params, set }) => {
        const user = await getUserById(params.id);

        if (user === null) {
            set.status = 404;
            return { errors: ["unknown user with id: " + params.id] };
        }

        assertUser(user);

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            role: user.role,
            createdAt: user.createdAt,
        };
    }, {
        params: t.Object({ id: t.Numeric() }),
    })
    .get('/sse/:id', ({ params, request }) => {
        const encoder = new TextEncoder();

        return new Response(new ReadableStream({
            start(controller) {
                let eventId = 0;

                const send = (data: any) => {
                    eventId++;
                    controller.enqueue(
                        encoder.encode(
                            `id: ${eventId}\n` +
                            `event: ${data.type}\n` +
                            `data: ${JSON.stringify(data)}\n\n`
                        )
                    );
                };

                const unsubscribe = subscribeUser(params.id, send);

                // Send initial connected event
                send({ type: "connected", userID: params.id });

                const heartbeat = setInterval(() => {
                    controller.enqueue(encoder.encode(`:\n\n`));
                }, 15000);

                request.signal.addEventListener("abort", () => {
                    clearInterval(heartbeat);
                    unsubscribe();
                    controller.close();
                });
            }
        }), {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        });
    }, {
        params: t.Object({ id: t.Numeric() }),
    })
    .get("/bets/:id", async (ctx) => {
        const { status } = ctx.query
        const user = await getUserById(ctx.params.id)
        if (user === null) {
            ctx.set.status = 400
            return { errors: ["unkown user with id: " + ctx.params.id] }
        }

        assertUser(user)

        let statusCondition;
        assert(status === undefined || BET_STATUSES.includes(status))
        if (status === "ongoing") {
            statusCondition = eq(marketsTable.status, "active");
        } else if (status === "won") {
            statusCondition = and(eq(marketsTable.status, "resolved"), eq(betsTable.outcomeId, marketsTable.resolvedOutcomeId));
        } else if (status === "lost") {
            statusCondition = and(eq(marketsTable.status, "resolved"), ne(betsTable.outcomeId, marketsTable.resolvedOutcomeId));
        }

        const bets = await db
            .select({
                id: betsTable.id,
                createdAt: betsTable.createdAt,
                userId: betsTable.userId,
                marketId: betsTable.marketId,
                outcomeId: betsTable.outcomeId,
                amount: betsTable.amount,
                winnings: betsTable.winnings,
                market: {
                    id: marketsTable.id,
                    title: marketsTable.title,
                    status: marketsTable.status,
                    resolvedOutcomeId: marketsTable.resolvedOutcomeId,
                },
                outcome: {
                    id: marketOutcomesTable.id,
                    title: marketOutcomesTable.title,
                },
            })
            .from(betsTable)
            .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
            .innerJoin(marketOutcomesTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
            .where(and(eq(betsTable.userId, user.id), statusCondition))
            .orderBy(desc(betsTable.createdAt))
            .limit(PAGE_LIMIT)
            .offset(ctx.query.page * PAGE_LIMIT);

        const baseCondition = eq(betsTable.userId, user.id);
        const whereCondition = statusCondition
            ? and(baseCondition, statusCondition)
            : baseCondition;

        const [totalRes] = await db
            .select({ value: count() })
            .from(betsTable)
            .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
            .where(whereCondition);

        const totalPages = !totalRes ? 0 : Math.ceil(totalRes.value / PAGE_LIMIT);
        const modifiedBets = await Promise.all(bets.map(async bet => {
            assertBet(bet)
            let status: typeof BET_STATUSES[number]
            let odds = 0

            if (bet.market.status === "active") {
                status = "ongoing"
                const oddsList = await calculateOdds(bet.market.id)
                const found = oddsList.find(o => o.outcomeId === bet.outcomeId)
                odds = found ? found.odds : 0
            } else if (bet.outcomeId === bet.market.resolvedOutcomeId) {
                status = "won"
                odds = bet.amount > 0 && bet.winnings ? Number((bet.winnings / bet.amount).toFixed(2)) : 0
            } else {
                status = "lost"
                odds = 0
            }

            return { ...bet, status, outcome: { ...bet.outcome, odds } }
        }))
        return { bets: modifiedBets, totalPages }
    }, {
        query: t.Object({
            page: t.Number({ minimum: 0, default: 0 }),
            status: t.Optional(t.Union(
                BET_STATUSES.map(s => t.Literal(s))
            )),
        }),
        params: t.Object({ id: t.Numeric() }),

    })
    .get("/markets/:id", async ({ params, query, set }) => {
        const user = await getUserById(params.id);
        if (user === null) {
            set.status = 404;
            return { errors: ["unknown user with id: " + params.id] };
        }
        assertUser(user);

        const statusCondition = query.status
            ? eq(marketsTable.status, query.status)
            : undefined;

        const whereCondition = statusCondition
            ? and(eq(marketsTable.createdBy, user.id), statusCondition)
            : eq(marketsTable.createdBy, user.id);

        const markets = await db
            .select({
                id: marketsTable.id,
                title: marketsTable.title,
                description: marketsTable.description,
                status: marketsTable.status,
                createdAt: marketsTable.createdAt,
                resolvedOutcomeId: marketsTable.resolvedOutcomeId,
                totalBetSize: sum(betsTable.amount),
                numParticipants: countDistinct(betsTable.userId),
            })
            .from(marketsTable)
            .leftJoin(betsTable, eq(betsTable.marketId, marketsTable.id))
            .where(whereCondition)
            .groupBy(marketsTable.id)
            .orderBy(desc(marketsTable.createdAt))
            .limit(PAGE_LIMIT)
            .offset(query.page * PAGE_LIMIT);

        const [totalRes] = await db
            .select({ value: count() })
            .from(marketsTable)
            .where(whereCondition);

        const totalPages = !totalRes ? 0 : Math.ceil(totalRes.value / PAGE_LIMIT);

        if (process.env.ENV === "DEV") {
            assert(!Number.isNaN(totalPages));
            assert(totalPages >= 0);

            for (const m of markets) {
                assert(!!m);
                assert(typeof m.id === "number");
                assert(m.id >= 0);
                assert(typeof m.title === "string");
                assert(m.title !== "");
                assert(m.status === "active" || m.status === "resolved");
                assert(typeof m.numParticipants === "number");
                assert(m.numParticipants >= 0);
                assert(m.totalBetSize === null || !Number.isNaN(Number(m.totalBetSize)));
                assert(m.totalBetSize === null || Number(m.totalBetSize) >= 0);
                assert(m.resolvedOutcomeId === null || typeof m.resolvedOutcomeId === "number");
                assert(m.status === "resolved" ? m.resolvedOutcomeId !== null : true);
            }
        }

        const parsedMarkets = markets.map(m => ({
            ...m,
            totalBetSize: m.totalBetSize ? parseFloat(m.totalBetSize) : 0,
        }));

        return { markets: parsedMarkets, totalPages };
    }, {
        query: t.Object({
            page: t.Number({ minimum: 0, default: 0 }),
            status: t.Optional(t.Union(
                schema.MARKET_STATUSES.map(s => t.Literal(s))
            )),
        }),
        params: t.Object({ id: t.Numeric() }),
    })
    .use(requireAuth)
    .get("/api-keys", async ({ user, set, query }) => {
        assert(user !== null, "ASSERTION ERROR: previous block should've catched this")

        if (!user) {
            set.status = 400
            return { errors: ["unauthorized to make such requests"] }
        }
        const keys = await db.select({
            id: apiKeysTable.id,
            name: apiKeysTable.name,
            createdAt: apiKeysTable.createdAt,
            lastUsedAt: apiKeysTable.lastUsedAt,
            expiresAt: apiKeysTable.expiresAt,
        }).from(apiKeysTable).where(eq(apiKeysTable.userId, user.id))
            .limit(PAGE_LIMIT)
            .offset(query.page * PAGE_LIMIT);
        const [totalRes] = await db
            .select({ value: count() })
            .from(apiKeysTable)
            .where(eq(apiKeysTable.userId, user.id));

        const totalPages = !totalRes ? 0 : Math.ceil(totalRes.value / PAGE_LIMIT);

        return { keys, totalPages };
    }, {
        query: t.Object({
            page: t.Number({ minimum: 0, default: 0 }),
        }),
    })
    .post("/api-keys", async ({ user, body, set, query }) => {
        assert(user !== null, "ASSERTION ERROR: previous block should've catched this")

        if (!user) {
            set.status = 400
            return { errors: ["unauthorized to make such requests"] }
        }

        const { raw, hash } = generateApiKey();
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        const [row] = await db.insert(apiKeysTable).values({
            userId: user.id,
            name: body.name,
            keyHash: hash,
            expiresAt,
        }).returning({
            id: apiKeysTable.id,
            name: apiKeysTable.name,
            createdAt: apiKeysTable.createdAt,
            expiresAt: apiKeysTable.expiresAt,
        });

        return { ...row, key: raw };
    }, {
        body: t.Object({
            name: t.String(),
            expiresAt: t.Optional(t.String()),
        })
    })
    .delete("/api-keys/:id", async ({ user, params, set }) => {
        console.log("DELETE hit", { user, params });

        assert(user !== null, "ASSERTION ERROR: previous block should've catched this")
        if (!user) {
            set.status = 400
            return { errors: ["unauthorized to make such requests"] }
        }
        const deleted = await db.delete(apiKeysTable)
            .where(and(eq(apiKeysTable.id, params.id), eq(apiKeysTable.userId, user.id)))
            .returning();
        if (!deleted.length) { set.status = 404; return { errors: ["Not found"] }; }
        assertAPIKey(deleted[0]!)
    }, { params: t.Object({ id: t.Numeric() }) })


