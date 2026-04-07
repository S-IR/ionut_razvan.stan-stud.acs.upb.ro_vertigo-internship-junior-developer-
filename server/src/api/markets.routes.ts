import { Elysia, t } from "elysia";
import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import { gte, sql, type BuildQueryResult, type ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "../db/schema";
import { eq, and, sum, countDistinct, asc, desc, inArray, SQL, count } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { validateMarketCreation, validateBet } from "../lib/validation";
import {
  assert,
  assertEnrichedOutcome,
  assertMarket,
  assertOutcome,
  assertUser,
} from "../lib/assert";
import { broadcastNewBet, broadcastUserProfileUpdate } from "./users.routes";
import { calculateOdds } from "./helpers";
import { createPubSub, createSSEResponse } from "../lib/sse";

export const PAGE_LIMIT = 20;

type TSchema = ExtractTablesWithRelations<typeof schema>;

export type MarketWithRelations = BuildQueryResult<
  TSchema,
  TSchema["marketsTable"],
  {
    with: {
      creator: { columns: { username: true } };
      outcomes: true;
    };
  }
>;

enum MarketEvent {
  NewMarket = "new-market",
  MarketUpdated = "market-updated",
}

export enum SORT_BY_OPTION {
  DateAsc = "DateAscending",
  DateDesc = "DateDescending",
  TotalBetSizeAsc = "TotalBetSizeAscending",
  TotalBetSizeDesc = "TotalBetSizeDescending",
  NumOfParticipantsAsc = "NumOfParticipantsAscending",
  NumOfParticipantsDesc = "NumOfParticipantsDescending",
}

export const LISTEN_TO_ALL_SSE_ID = -1;

const { subscribe: subscribeMarket, publish: publishMarket } = createPubSub();

export function broadcastNewMarket(marketData: MarketWithRelations) {
  publishMarket(LISTEN_TO_ALL_SSE_ID, {
    type: MarketEvent.NewMarket,
    market: marketData,
  });
}

export function broadcastSingleMarketUpdate(marketID: number) {
  const payload = { type: MarketEvent.MarketUpdated, id: marketID };
  publishMarket(marketID, payload);
  publishMarket(LISTEN_TO_ALL_SSE_ID, payload);
}

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)

  .get(
    "/sse/:id",
    ({ params, request }) =>
      createSSEResponse(request, (send) => subscribeMarket(params.id, send), {
        type: "connected",
        id: params.id,
      }),
    {
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .get(
    "/public",
    async ({ query }) => {
      const statusFilter: "active" | "resolved" =
        query.status === "resolved" ? "resolved" : "active";

      const orderBy: SQL[] = [];
      for (const opt of query.sort) {
        switch (opt) {
          case SORT_BY_OPTION.DateAsc:
            orderBy.push(asc(marketsTable.createdAt));
            break;
          case SORT_BY_OPTION.DateDesc:
            orderBy.push(desc(marketsTable.createdAt));
            break;
          case SORT_BY_OPTION.TotalBetSizeAsc:
            orderBy.push(asc(sum(betsTable.amount)));
            break;
          case SORT_BY_OPTION.TotalBetSizeDesc:
            orderBy.push(desc(sum(betsTable.amount)));
            break;
          case SORT_BY_OPTION.NumOfParticipantsAsc:
            orderBy.push(asc(countDistinct(betsTable.userId)));
            break;
          case SORT_BY_OPTION.NumOfParticipantsDesc:
            orderBy.push(desc(countDistinct(betsTable.userId)));
            break;
        }
      }
      if (orderBy.length === 0) orderBy.push(desc(marketsTable.createdAt));

      const markets = await db
        .select({
          id: marketsTable.id,
          title: marketsTable.title,
          status: marketsTable.status,
          creatorUsername: usersTable.username,
          totalBetSize: sum(betsTable.amount),
          numParticipants: countDistinct(betsTable.userId),
        })
        .from(marketsTable)
        .innerJoin(usersTable, eq(marketsTable.createdBy, usersTable.id))
        .leftJoin(betsTable, eq(betsTable.marketId, marketsTable.id))
        .where(eq(marketsTable.status, statusFilter))
        .groupBy(marketsTable.id)
        .orderBy(...(orderBy as [SQL, ...SQL[]]))
        .limit(PAGE_LIMIT)
        .offset(query.page * PAGE_LIMIT);

      const marketIds = markets.map((m) => m.id);

      const outcomes =
        marketIds.length > 0
          ? await db
            .select({
              id: marketOutcomesTable.id,
              marketId: marketOutcomesTable.marketId,
              title: marketOutcomesTable.title,
              position: marketOutcomesTable.position,
              totalBets: sum(betsTable.amount),
            })
            .from(marketOutcomesTable)
            .leftJoin(betsTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
            .where(inArray(marketOutcomesTable.marketId, marketIds))
            .groupBy(marketOutcomesTable.id)
          : [];

      const [totalRes] = await db
        .select({ count: count() })
        .from(marketsTable)
        .where(eq(marketsTable.status, statusFilter));
      const totalPages = totalRes ? Math.ceil(totalRes.count / PAGE_LIMIT) : 0;

      const enrichedMarkets = await Promise.all(
        markets.map(async (m) => {
          const currOutcomes = outcomes.filter((o) => o.marketId === m.id);
          const oddsList = await calculateOdds(m.id);

          const enrichedOutcomes = currOutcomes.map((o) => {
            const totalBets = Number(o.totalBets) || 0;
            const odds = oddsList.find((odd) => odd.outcomeId === o.id)?.odds ?? 0;
            if (process.env.ENV === "DEV")
              assertEnrichedOutcome({
                id: o.id,
                title: o.title,
                totalBets,
                odds,
              });
            return { id: o.id, title: o.title, totalBets, odds };
          });

          return {
            id: m.id,
            title: m.title,
            status: m.status,
            creator: m.creatorUsername,
            totalMarketBets: Number(m.totalBetSize) || 0,
            outcomes: enrichedOutcomes,
          };
        }),
      );

      return { totalPages, markets: enrichedMarkets };
    },
    {
      query: t.Object({
        status: t.Optional(t.Union(schema.MARKET_STATUSES.map((s) => t.Literal(s)))),
        page: t.Number({ minimum: 0, default: 0 }),
        sort: t.Array(t.Enum(SORT_BY_OPTION), { default: [] }),
      }),
    },
  )

  .get(
    "/public/:id",
    async ({ params, set }) => {
      if (process.env.ENV === "DEV") {
        assert(typeof params.id === "number" && params.id >= 0);
      }

      const market = await db.query.marketsTable.findFirst({
        where: eq(marketsTable.id, params.id),
        with: {
          creator: { columns: { username: true } },
          outcomes: { orderBy: (o, { asc }) => asc(o.position) },
        },
      });

      if (!market) {
        set.status = 404;
        return { errors: ["Market not found"] };
      }

      if (process.env.ENV === "DEV") {
        assertMarket(market);
        assert(typeof market.creator?.username === "string" && market.creator.username !== "");
        assert(Array.isArray(market.outcomes));
        market.outcomes.forEach(assertOutcome);
      }

      const betsPerOutcome = await db
        .select({
          outcomeId: betsTable.outcomeId,
          totalBets: sum(betsTable.amount),
        })
        .from(betsTable)
        .where(eq(betsTable.marketId, params.id))
        .groupBy(betsTable.outcomeId);

      const betsMap = new Map<number, number>(
        betsPerOutcome.map((b) => [b.outcomeId, Number(b.totalBets) || 0]),
      );
      const totalMarketBets = Array.from(betsMap.values()).reduce((sum, v) => sum + v, 0);

      const oddsList = await calculateOdds(params.id);

      const enrichedOutcomes = market.outcomes.map((o) => {
        const totalBets = betsMap.get(o.id) ?? 0;
        const odds = oddsList.find((odd) => odd.outcomeId === o.id)?.odds ?? 0;
        if (process.env.ENV === "DEV")
          assertEnrichedOutcome({ id: o.id, title: o.title, totalBets, odds });
        return { id: o.id, title: o.title, totalBets, odds };
      });

      return {
        id: market.id,
        title: market.title,
        description: market.description,
        status: market.status,
        creator: market.creator.username,
        totalMarketBets,
        outcomes: enrichedOutcomes,
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
    },
  )

  .use(requireAuth)

  .post(
    "/public",
    async ({ body, set, user }) => {
      if (!user) {
        set.status = 500;
        return { errors: ["internal server error"] };
      }
      assertUser(user);

      const { title, description, outcomes } = body;
      const errors = validateMarketCreation(title, description || "", outcomes);
      if (errors.length > 0) {
        set.status = 400;
        return { errors };
      }

      if (process.env.ENV === "DEV") {
        assert(typeof title === "string" && title !== "");
        assert(description === undefined || typeof description === "string");
        assert(Array.isArray(outcomes) && outcomes.length >= 2);
        for (const o of outcomes) assert(typeof o === "string" && o !== "");
      }

      const [market] = await db
        .insert(marketsTable)
        .values({ title, description: description || null, createdBy: user.id })
        .returning();
      assert(market);

      const outcomeIds = await db
        .insert(marketOutcomesTable)
        .values(
          outcomes.map((title: string, index: number) => ({
            marketId: market.id,
            title,
            position: index,
          })),
        )
        .returning();

      if (process.env.ENV === "DEV") {
        assertMarket(market);
        assert(outcomeIds.length === outcomes.length);
        for (const o of outcomeIds) {
          assertOutcome(o);
          assert(o.marketId === market.id);
        }
      }

      set.status = 201;
      broadcastNewMarket({ ...market, creator: user, outcomes: [] });

      return {
        id: market.id,
        title: market.title,
        description: market.description,
        status: market.status,
        outcomes: outcomeIds,
      };
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.String()),
        outcomes: t.Array(t.String()),
      }),
    },
  )

  .post(
    "/public/:id/bets",
    async ({ params, body, set, user }) => {
      if (!user) {
        set.status = 500;
        return { errors: ["internal server error"] };
      }
      assertUser(user);


      if (user.role === "admin") {
        set.status = 400;
        return { errors: ["admins are not allowed to place bets"] };
      }

      const { outcomeId, amount } = body;
      const marketId = params.id;

      const errors = validateBet(amount);
      if (errors.length > 0) {
        set.status = 400;
        return { errors };
      }

      if (process.env.ENV === "DEV") {
        assert(typeof marketId === "number" && marketId >= 0);
        assert(typeof outcomeId === "number" && outcomeId >= 0);
        assert(typeof amount === "number" && amount > 0);
      }

      const market = await db.query.marketsTable.findFirst({
        where: eq(marketsTable.id, marketId),
      });
      if (!market) {
        set.status = 404;
        return { errors: ["Market not found"] };
      }
      if (market.status !== "active") {
        set.status = 400;
        return { errors: ["Market is not active"] };
      }

      const existingBet = await db.query.betsTable.findFirst({
        where: and(eq(betsTable.userId, user.id), eq(betsTable.marketId, marketId)),
      });
      if (existingBet && existingBet.outcomeId !== outcomeId) {
        set.status = 400;
        return { errors: ["You cannot bet on multiple outcomes"] };
      }

      const outcome = await db.query.marketOutcomesTable.findFirst({
        where: and(
          eq(marketOutcomesTable.id, outcomeId),
          eq(marketOutcomesTable.marketId, marketId),
        ),
      });
      if (!outcome) {
        set.status = 404;
        return { errors: ["Outcome not found"] };
      }

      if (process.env.ENV === "DEV") {
        assertMarket(market);
        assertOutcome(outcome);
        assert(outcome.marketId === marketId);
      }

      const { bet, errors: txErrors } = await db.transaction(async (tx) => {
        const [updatedUser] = await tx
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} - ${amount}` })
          .where(and(eq(usersTable.id, user.id), gte(usersTable.balance, amount)))
          .returning({ newBalance: usersTable.balance });

        if (!updatedUser) {
          return {
            bet: undefined,
            errors: [`Insufficient balance to bet ${amount.toFixed(2)}`],
          };
        }

        const [bet] = await tx
          .insert(betsTable)
          .values({
            userId: user.id,
            marketId,
            outcomeId,
            amount: Number(amount),
          })
          .returning();

        assert(bet);
        return { bet, errors: [] };
      });

      if (txErrors?.length) {
        set.status = 400;
        return { errors: txErrors };
      }

      set.status = 201;
      broadcastSingleMarketUpdate(market.id);
      broadcastUserProfileUpdate(user.id);
      broadcastNewBet(user.id);

      return {
        id: bet!.id,
        userId: bet!.userId,
        marketId: bet!.marketId,
        outcomeId: bet!.outcomeId,
        amount: bet!.amount,
        winning: null,
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({ outcomeId: t.Number(), amount: t.Number() }),
    },
  )
  .post(
    "/:id/close",
    async ({ body, params, set, user }) => {
      if (!user) {
        set.status = 500;
        return { errors: ["internal server error"] };
      }
      assertUser(user);

      if (process.env.ENV === "DEV") {
        assert(typeof params.id === "number" && params.id >= 0);
        assert(typeof body.resolvedOutcomeId === "number" && body.resolvedOutcomeId >= 0);
      }

      if (user.role !== "admin") {
        set.status = 401;
        return { errors: ["Unauthorized to close a market"] };
      }

      const market = await db.query.marketsTable.findFirst({
        where: eq(marketsTable.id, params.id),
        with: { outcomes: true },
      });
      if (!market) {
        set.status = 404;
        return { errors: ["Market not found"] };
      }
      if (market.status !== "active") {
        set.status = 400;
        return { errors: ["Market is not active"] };
      }

      if (process.env.ENV === "DEV") {
        assertMarket(market);
        assert(Array.isArray(market.outcomes) && market.outcomes.length > 0);
        market.outcomes.forEach(assertOutcome);
      }

      const validOutcome = market.outcomes.find((o) => o.id === body.resolvedOutcomeId);
      if (!validOutcome) {
        set.status = 400;
        return { errors: ["Unknown outcome id for this market"] };
      }

      const allBets = await db.query.betsTable.findMany({
        where: eq(betsTable.marketId, params.id),
      });
      const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);
      const winningBets = allBets.filter((bet) => bet.outcomeId === body.resolvedOutcomeId);
      const totalWinningStakes = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

      assert(!Number.isNaN(totalPool) && !Number.isNaN(totalWinningStakes));
      assert(totalWinningStakes <= totalPool);

      const [updated] = await db
        .update(marketsTable)
        .set({ status: "resolved", resolvedOutcomeId: body.resolvedOutcomeId })
        .where(eq(marketsTable.id, params.id))
        .returning();
      assert(updated);
      assertMarket(updated);

      if (totalPool > 0 && winningBets.length > 0) {
        await db.transaction(async (tx) => {
          await Promise.all(
            winningBets.map(async (bet) => {
              const payout = (bet.amount / totalWinningStakes) * totalPool;
              assert(!Number.isNaN(payout) && payout >= 0);

              await tx.update(betsTable).set({ winnings: payout }).where(eq(betsTable.id, bet.id));

              const winner = await tx.query.usersTable.findFirst({
                where: eq(usersTable.id, bet.userId),
              });
              await tx
                .update(usersTable)
                .set({ balance: winner!.balance + payout })
                .where(eq(usersTable.id, bet.userId));
            }),
          );
        });
      }

      for (const bet of allBets) broadcastUserProfileUpdate(bet.userId);
      broadcastSingleMarketUpdate(params.id);

      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        resolvedOutcomeId: updated.resolvedOutcomeId,
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({ resolvedOutcomeId: t.Number() }),
    },
  );

export async function settleMarket(marketId: number, resolvedOutcomeId: number) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
    with: { outcomes: true },
  });
  assert(market);

  const allBets = await db.query.betsTable.findMany({
    where: eq(betsTable.marketId, marketId),
  });

  const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);
  const winningBets = allBets.filter((bet) => bet.outcomeId === resolvedOutcomeId);
  const totalWinningStakes = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

  assert(!Number.isNaN(totalPool) && !Number.isNaN(totalWinningStakes));
  assert(totalWinningStakes <= totalPool);

  const [updated] = await db
    .update(marketsTable)
    .set({ status: "resolved", resolvedOutcomeId })
    .where(eq(marketsTable.id, marketId))
    .returning();

  assert(updated);

  if (totalPool > 0 && winningBets.length > 0) {
    await db.transaction(async (tx) => {
      await Promise.all(
        winningBets.map(async (bet) => {
          const payout = (bet.amount / totalWinningStakes) * totalPool;

          assert(!Number.isNaN(payout) && payout >= 0);

          await tx.update(betsTable).set({ winnings: payout }).where(eq(betsTable.id, bet.id));

          await tx
            .update(usersTable)
            .set({ balance: sql`${usersTable.balance} + ${payout}` })
            .where(eq(usersTable.id, bet.userId));
        }),
      );
    });
  }

  return { updated, allBets };
}
