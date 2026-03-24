import { Elysia, t } from "elysia";
import { authMiddleware, requireAuth } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet, handleCloseMarket } from "./handlers";
import type { ServerWebSocket } from 'bun';   // ← this is the key import
import { type BuildQueryResult, type DBQueryConfig, type ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "../db/schema";


type MarketsWSQuery = { status?: string; page: number };
type SingleMarketWSQuery = {}

const marketsClients = new Set<ServerWebSocket<MarketsWSQuery>>();
const LISTEN_TO_ALL_MARKET_UPDATES_ID = -1
const singleMarketClients = new Map<number, Set<ServerWebSocket<SingleMarketWSQuery>>>();

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
export function broadcastNewMarket(marketData: MarketWithRelations) {
  const payload = JSON.stringify({ type: "markets-updated" });

  for (const client of marketsClients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
export function broadcastSingleMarketUpdate(marketID: number) {
  const subcribed = singleMarketClients.get(marketID)
  if (subcribed === undefined || subcribed.size === 0) return
  const payload = JSON.stringify({ type: "market-updated", id: marketID })
  for (const sub of subcribed) {
    sub.send(payload)
  }
  const subscribedToAll = singleMarketClients.get(LISTEN_TO_ALL_MARKET_UPDATES_ID)
  if (subscribedToAll === undefined || subscribedToAll.size === 0) return

  for (const sub of subscribedToAll) {
    sub.send(payload)
  }

}
export enum SORT_BY_OPTION {
  DateAsc = "DateAscending",
  DateDesc = "DateDescending",

  TotalBetSizeAsc = "TotalBetSizeAscending",
  TotalBetSizeDesc = "TotalBetSizeDescending",

  NumOfParticipantsAsc = "NumOfParticipantsAscending",
  NumOfParticipantsDesc = "NumOfParticipantsDescending"

}


export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .ws('/ws/all', {
    open(ws) { marketsClients.add(ws.raw as ServerWebSocket<MarketsWSQuery>); },
    close(ws) { marketsClients.delete(ws.raw as ServerWebSocket<MarketsWSQuery>); },
  })
  .get("/", handleListMarkets as any, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Number({ minimum: 0, default: 0 }),
      sort: t.Array(t.Enum(SORT_BY_OPTION), { default: [] }),
    }),
    beforeHandle({ query, set }) {
      const options = query.sort;
      if (options.length === 0) return;
      const conflicts = [
        [SORT_BY_OPTION.DateAsc, SORT_BY_OPTION.DateDesc],
        [SORT_BY_OPTION.TotalBetSizeAsc, SORT_BY_OPTION.TotalBetSizeDesc],
        [SORT_BY_OPTION.NumOfParticipantsAsc, SORT_BY_OPTION.NumOfParticipantsDesc],
      ] as const;
      for (const [asc, desc] of conflicts) {
        if (options.includes(asc) && options.includes(desc)) {
          set.status = 422;
          return { message: `Cannot use both ${asc} and ${desc}` };
        }
      }
    },
  })

  .ws('/ws/:id', {
    params: t.Object({ id: t.Numeric() }),

    open(ws) {
      console.log(`opened ws with ${ws.data.params.id}`)
      const raw = ws.raw as ServerWebSocket<SingleMarketWSQuery>;

      const marketId = Number(ws.data.params.id);

      const existing = singleMarketClients.get(marketId);

      if (existing) {
        existing.add(raw);
      } else {
        singleMarketClients.set(marketId, new Set([raw]));
      }
    },

    close(ws) {
      const raw = ws.raw as ServerWebSocket<SingleMarketWSQuery>;

      const marketId = Number(ws.data.params.id);

      const existing = singleMarketClients.get(marketId);
      if (!existing) return;

      existing.delete(raw)

      if (existing.size === 0) {
        singleMarketClients.delete(marketId);
      } else {
        singleMarketClients.set(marketId, existing);
      }
    },
  })

  .get("/:id", handleGetMarket as any, {
    params: t.Object({ id: t.Numeric() }),
  })
  .use(requireAuth)
  .post("/", handleCreateMarket as any, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      outcomes: t.Array(t.String()),
    }),
  })
  .post("/:id/bets", handlePlaceBet as any, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      outcomeId: t.Number(),
      amount: t.Number(),
    }),


  })
  .post("/:id/close", handleCloseMarket as any, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      resolvedOutcomeId: t.Number(),
    }),
  })