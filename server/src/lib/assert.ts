import type { apiKeysTable, betsTable, marketOutcomesTable, marketsTable, usersTable } from "../db/schema"


export function assertMarket(market: typeof marketsTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    assert(!!market);
    assert(typeof market.id === "number");
    assert(market.id >= 0);
    assert(typeof market.title === "string");
    assert(market.title !== "");
    assert(market.status === "active" || market.status === "resolved");
    assert(typeof market.createdBy === "number");
    assert(market.createdBy >= 0);
}

export function assertOutcome(outcome: typeof marketOutcomesTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    assert(!!outcome);
    assert(typeof outcome.id === "number");
    assert(outcome.id >= 0);
    assert(typeof outcome.marketId === "number");
    assert(outcome.marketId >= 0);
    assert(typeof outcome.title === "string");
    assert(outcome.title !== "");
    assert(typeof outcome.position === "number");
    assert(outcome.position >= 0);
}

export function assertBet(bet: typeof betsTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    assert(!!bet);
    assert(typeof bet.id === "number");
    assert(bet.id >= 0);
    assert(typeof bet.userId === "number");
    assert(bet.userId >= 0);
    assert(typeof bet.marketId === "number");
    assert(bet.marketId >= 0);
    assert(typeof bet.outcomeId === "number");
    assert(bet.outcomeId >= 0);
    assert(typeof bet.amount === "number");
    assert(bet.amount > 0);


    assert(bet.winnings === null || typeof bet.winnings === "number");
    if (bet.winnings !== null) {
        assert(bet.winnings > 0);
    }
}

export function assertUser(user: typeof usersTable.$inferSelect) {
    if (process.env.ENV !== "DEV") return;
    assert(!!user);
    assert(typeof user.id === "number");
    assert(user.id >= 0);
    assert(typeof user.email === "string");
    assert(user.email !== "");
    assert(typeof user.passwordHash === "string");
    assert(user.passwordHash !== "");
    assert(typeof user.role === "string");
    assert(user.role === "admin" || user.role === "normal");
    assert(typeof user.username === "string");
    assert(user.username !== "");
    assert(typeof user.balance === "number");
    assert(user.balance >= 0);
}

export function assertEnrichedOutcome(outcome: { id: number; title: string; totalBets: number; odds: number }) {
    if (process.env.ENV !== "DEV") return;
    assert(!!outcome);
    assert(typeof outcome.id === "number");
    assert(outcome.id >= 0);
    assert(typeof outcome.title === "string");
    assert(outcome.title !== "");
    assert(typeof outcome.totalBets === "number");
    assert(outcome.totalBets >= 0);
    assert(typeof outcome.odds === "number");
    assert(outcome.odds >= 0 && outcome.odds <= 100);
}
export function assertAPIKey(key: typeof apiKeysTable.$inferInsert) {
    assert(key.createdAt)
    assert(key.id)
    assert(key.keyHash !== "")

}
export function assert(cond: unknown, msg: string = "ASSERTION FAILED"): asserts cond {
    if (!cond) throw new Error(msg);
}