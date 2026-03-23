import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet } from "./handlers";
import type { ServerWebSocket } from 'bun';   // ← this is the key import
import { type BuildQueryResult, type DBQueryConfig, type ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "../db/schema";


type MarketWSQuery = { status?: string; page: number };

const marketClients = new Set<ServerWebSocket<MarketWSQuery>>();

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
  const payload = { type: "new-market" };

  for (const client of marketClients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
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
  .ws('/ws', {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Number({ default: 1 }),
    }),
    open(ws) {
      marketClients.add(ws.raw as ServerWebSocket<MarketWSQuery>);
    },
    close(ws) {
      marketClients.delete(ws.raw as ServerWebSocket<MarketWSQuery>);
    },

  })
  .get("/", handleListMarkets as any, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Number({ minimum: 0, default: 0 }),
      sort: t.Array(t.Enum(SORT_BY_OPTION), { default: [] }),


    }),
    beforeHandle({ query, set }) {
      const options = query.sort;
      if (options.length === 0) return
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
  .get("/:id", handleGetMarket as any, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .post("/", handleCreateMarket as any, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet as any, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        }),
  );
