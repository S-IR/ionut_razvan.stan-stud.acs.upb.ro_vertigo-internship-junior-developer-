import { eq, sum } from "drizzle-orm";
import db from "../db";
import { betsTable, marketOutcomesTable } from "../db/schema";

export async function calculateOdds(marketId: number) {
  const data = await db
    .select({
      outcomeId: marketOutcomesTable.id,
      outcomeBets: sum(betsTable.amount),
    })
    .from(marketOutcomesTable)
    .leftJoin(betsTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
    .where(eq(marketOutcomesTable.marketId, marketId))
    .groupBy(marketOutcomesTable.id);

  const total = data.reduce((sum, row) => sum + (Number(row.outcomeBets) || 0), 0);

  return data.map((row) => {
    const bets = Number(row.outcomeBets) || 0;
    const odds = bets > 0 ? Number((total / bets).toFixed(2)) : 0;
    return { outcomeId: row.outcomeId, odds, total };
  });
}
