import type { betsTable, marketOutcomesTable, marketsTable, usersTable } from "../db/schema"


export function assertMarket(market: typeof marketsTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    console.assert(!!market);
    console.assert(typeof market.id === "number");
    console.assert(market.id >= 0);
    console.assert(typeof market.title === "string");
    console.assert(market.title !== "");
    console.assert(market.status === "active" || market.status === "resolved");
    console.assert(typeof market.createdBy === "number");
    console.assert(market.createdBy >= 0);
}

export function assertOutcome(outcome: typeof marketOutcomesTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    console.assert(!!outcome);
    console.assert(typeof outcome.id === "number");
    console.assert(outcome.id >= 0);
    console.assert(typeof outcome.marketId === "number");
    console.assert(outcome.marketId >= 0);
    console.assert(typeof outcome.title === "string");
    console.assert(outcome.title !== "");
    console.assert(typeof outcome.position === "number");
    console.assert(outcome.position >= 0);
}

export function assertBet(bet: typeof betsTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    console.assert(!!bet);
    console.assert(typeof bet.id === "number");
    console.assert(bet.id >= 0);
    console.assert(typeof bet.userId === "number");
    console.assert(bet.userId >= 0);
    console.assert(typeof bet.marketId === "number");
    console.assert(bet.marketId >= 0);
    console.assert(typeof bet.outcomeId === "number");
    console.assert(bet.outcomeId >= 0);
    console.assert(typeof bet.amount === "number");
    console.assert(bet.amount > 0);
}

export function assertUser(user: typeof usersTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    console.assert(!!user);
    console.assert(typeof user.id === "number");
    console.assert(user.id >= 0);
    console.assert(typeof user.email === "string");
    console.assert(user.email !== "");
    console.assert(typeof user.passwordHash === "string");
    console.assert(user.passwordHash !== "");
    console.assert(typeof user.role === "string");
    console.assert(user.role === "admin" || user.role === "normal");
    console.assert(typeof user.username === "string");
    console.assert(user.username !== "");
}

export function assertEnrichedOutcome(outcome: { id: number; title: string; totalBets: number; odds: number }) {
    if (process.env.ENV !== "DEV") return;
    console.assert(!!outcome);
    console.assert(typeof outcome.id === "number");
    console.assert(outcome.id >= 0);
    console.assert(typeof outcome.title === "string");
    console.assert(outcome.title !== "");
    console.assert(typeof outcome.totalBets === "number");
    console.assert(outcome.totalBets >= 0);
    console.assert(typeof outcome.odds === "number");
    console.assert(outcome.odds >= 0 && outcome.odds <= 100);
}