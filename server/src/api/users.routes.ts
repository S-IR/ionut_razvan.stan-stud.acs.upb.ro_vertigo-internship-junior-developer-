import { Elysia, t } from "elysia";
import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import {
  apiKeysTable,
  betsTable,
  marketOutcomesTable,
  marketsTable,
  usersTable,
} from "../db/schema";
import db from "../db";
import { and, count, countDistinct, desc, eq, ne, sum } from "drizzle-orm";
import { PAGE_LIMIT, LISTEN_TO_ALL_SSE_ID } from "./markets.routes";
import { assert, assertAPIKey, assertBet, assertUser } from "../lib/assert";
import { getUserById } from "../lib/auth";
import { generateApiKey } from "../lib/apiKeys";
import * as schema from "../db/schema";
import { calculateOdds } from "./helpers";
import { createPubSub, createSSEResponse } from "../lib/sse";

enum WSUserUpdates {
  UserUpdated = "user-updated",
  NewBet = "bet-new",
}

export const BET_STATUSES = ["ongoing", "won", "lost"] as const;

const { subscribe: subscribeUser, publish: publishUser } = createPubSub();

export function broadcastUserProfileUpdate(userID: number) {
  publishUser(userID, { type: WSUserUpdates.UserUpdated, userID });
}

export function broadcastNewBet(userID: number) {
  const payload = { type: WSUserUpdates.NewBet, userID };
  publishUser(userID, payload);
  publishUser(LISTEN_TO_ALL_SSE_ID, payload);
}

export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .use(authMiddleware)

  .get(
    "/leaderboards",
    async ({ query }) => {
      assert(query.page >= 0);
      const page = query.page;

      const baseQuery = db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          totalWinnings: sum(betsTable.winnings).as("totalWinnings"),
        })
        .from(betsTable)
        .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .where(
          and(
            eq(marketsTable.status, "resolved"),
            eq(betsTable.outcomeId, marketsTable.resolvedOutcomeId),
          ),
        )
        .groupBy(usersTable.id);

      const leaderboard = baseQuery.as("leaderboard");

      const topUsersDB = await db
        .select()
        .from(leaderboard)
        .orderBy(desc(leaderboard.totalWinnings))
        .limit(PAGE_LIMIT)
        .offset(page * PAGE_LIMIT);

      const [totalRes] = await db.select({ total: count() }).from(leaderboard);
      const totalPages = Math.ceil((totalRes?.total ?? 0) / PAGE_LIMIT);

      const topUsers = topUsersDB.map((user) => ({
        ...user,
        totalWinnings: user.totalWinnings
          ? parseFloat(user.totalWinnings)
          : null,
      }));

      if (process.env.ENV === "DEV") {
        assert(!Number.isNaN(totalPages) && totalPages >= 0);
        for (const user of topUsers) {
          assert(!!user && typeof user.id === "number" && user.id >= 0);
          assert(typeof user.username === "string" && user.username !== "");
          assert(
            user.totalWinnings === null ||
              (typeof user.totalWinnings === "number" &&
                user.totalWinnings >= 0),
          );
        }
      }

      return { topUsers, totalPages };
    },
    {
      query: t.Object({ page: t.Numeric({ minimum: 0, default: 0 }) }),
    },
  )

  .get(
    "/:id",
    async ({ params, set }) => {
      const user = await getUserById(params.id);
      if (!user) {
        set.status = 404;
        return { errors: ["Unknown user with id: " + params.id] };
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
    },
    {
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .get(
    "/sse/:id",
    ({ params, request }) =>
      createSSEResponse(request, (send) => subscribeUser(params.id, send), {
        type: "connected",
        userID: params.id,
      }),
    {
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .get(
    "/bets/:id",
    async ({ params, query, set }) => {
      const user = await getUserById(params.id);
      if (!user) {
        set.status = 400;
        return { errors: ["Unknown user with id: " + params.id] };
      }
      assertUser(user);

      const { status } = query;
      assert(status === undefined || BET_STATUSES.includes(status));

      let statusCondition;
      if (status === "ongoing") {
        statusCondition = eq(marketsTable.status, "active");
      } else if (status === "won") {
        statusCondition = and(
          eq(marketsTable.status, "resolved"),
          eq(betsTable.outcomeId, marketsTable.resolvedOutcomeId),
        );
      } else if (status === "lost") {
        statusCondition = and(
          eq(marketsTable.status, "resolved"),
          ne(betsTable.outcomeId, marketsTable.resolvedOutcomeId),
        );
      }

      const whereCondition = statusCondition
        ? and(eq(betsTable.userId, user.id), statusCondition)
        : eq(betsTable.userId, user.id);

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
        .innerJoin(
          marketOutcomesTable,
          eq(betsTable.outcomeId, marketOutcomesTable.id),
        )
        .where(whereCondition)
        .orderBy(desc(betsTable.createdAt))
        .limit(PAGE_LIMIT)
        .offset(query.page * PAGE_LIMIT);

      const [totalRes] = await db
        .select({ value: count() })
        .from(betsTable)
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .where(whereCondition);

      const totalPages = totalRes ? Math.ceil(totalRes.value / PAGE_LIMIT) : 0;

      const modifiedBets = await Promise.all(
        bets.map(async (bet) => {
          assertBet(bet);
          let betStatus: (typeof BET_STATUSES)[number];
          let odds = 0;

          if (bet.market.status === "active") {
            betStatus = "ongoing";
            const oddsList = await calculateOdds(bet.market.id);
            odds =
              oddsList.find((o) => o.outcomeId === bet.outcomeId)?.odds ?? 0;
          } else if (bet.outcomeId === bet.market.resolvedOutcomeId) {
            betStatus = "won";
            odds =
              bet.amount > 0 && bet.winnings
                ? Number((bet.winnings / bet.amount).toFixed(2))
                : 0;
          } else {
            betStatus = "lost";
            odds = 0;
          }

          return {
            ...bet,
            status: betStatus,
            outcome: { ...bet.outcome, odds },
          };
        }),
      );

      return { bets: modifiedBets, totalPages };
    },
    {
      query: t.Object({
        page: t.Number({ minimum: 0, default: 0 }),
        status: t.Optional(t.Union(BET_STATUSES.map((s) => t.Literal(s)))),
      }),
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .get(
    "/markets/:id",
    async ({ params, query, set }) => {
      const user = await getUserById(params.id);
      if (!user) {
        set.status = 404;
        return { errors: ["Unknown user with id: " + params.id] };
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
      const totalPages = totalRes ? Math.ceil(totalRes.value / PAGE_LIMIT) : 0;

      if (process.env.ENV === "DEV") {
        assert(!Number.isNaN(totalPages) && totalPages >= 0);
        for (const m of markets) {
          assert(!!m && typeof m.id === "number" && m.id >= 0);
          assert(typeof m.title === "string" && m.title !== "");
          assert(m.status === "active" || m.status === "resolved");
          assert(
            typeof m.numParticipants === "number" && m.numParticipants >= 0,
          );
          assert(
            m.totalBetSize === null || !Number.isNaN(Number(m.totalBetSize)),
          );
          assert(
            m.resolvedOutcomeId === null ||
              typeof m.resolvedOutcomeId === "number",
          );
          assert(m.status === "resolved" ? m.resolvedOutcomeId !== null : true);
        }
      }

      return {
        markets: markets.map((m) => ({
          ...m,
          totalBetSize: m.totalBetSize ? parseFloat(m.totalBetSize) : 0,
        })),
        totalPages,
      };
    },
    {
      query: t.Object({
        page: t.Number({ minimum: 0, default: 0 }),
        status: t.Optional(
          t.Union(schema.MARKET_STATUSES.map((s) => t.Literal(s))),
        ),
      }),
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .use(requireAuth)

  .get(
    "/api-keys",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 400;
        return { errors: ["Unauthorized"] };
      }

      const keys = await db
        .select({
          id: apiKeysTable.id,
          name: apiKeysTable.name,
          createdAt: apiKeysTable.createdAt,
          lastUsedAt: apiKeysTable.lastUsedAt,
          expiresAt: apiKeysTable.expiresAt,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.userId, user.id))
        .limit(PAGE_LIMIT)
        .offset(query.page * PAGE_LIMIT);

      const [totalRes] = await db
        .select({ value: count() })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.userId, user.id));
      const totalPages = totalRes ? Math.ceil(totalRes.value / PAGE_LIMIT) : 0;

      return { keys, totalPages };
    },
    {
      query: t.Object({ page: t.Number({ minimum: 0, default: 0 }) }),
    },
  )

  .post(
    "/api-keys",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 400;
        return { errors: ["Unauthorized"] };
      }

      const { raw, hash } = generateApiKey();
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

      const [row] = await db
        .insert(apiKeysTable)
        .values({ userId: user.id, name: body.name, keyHash: hash, expiresAt })
        .returning({
          id: apiKeysTable.id,
          name: apiKeysTable.name,
          createdAt: apiKeysTable.createdAt,
          expiresAt: apiKeysTable.expiresAt,
        });

      return { ...row, key: raw };
    },
    {
      body: t.Object({ name: t.String(), expiresAt: t.Optional(t.String()) }),
    },
  )

  .delete(
    "/api-keys/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 400;
        return { errors: ["Unauthorized"] };
      }

      const [deleted] = await db
        .delete(apiKeysTable)
        .where(
          and(eq(apiKeysTable.id, params.id), eq(apiKeysTable.userId, user.id)),
        )
        .returning();

      if (!deleted) {
        set.status = 404;
        return { errors: ["Not found"] };
      }
      assertAPIKey(deleted);
    },
    {
      params: t.Object({ id: t.Numeric() }),
    },
  );
