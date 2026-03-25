import { eq, and, sum, countDistinct, asc, desc, inArray, SQL, count, } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable, usersRelations } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";
import { broadcastNewMarket, broadcastSingleMarketUpdate, SORT_BY_OPTION } from "./markets.routes";
import { type Context } from "elysia";
import { assertBet, assertEnrichedOutcome, assertMarket, assertOutcome, assertUser } from "../lib/assert";

type JwtSigner = {
  sign: (payload: Record<string, string | number>) => Promise<string>;
  verify: (token?: string) => Promise<Record<string, string | number> | false>;
};

type AuthContext<TBody> = Context<{ body: TBody }> & {
  jwt: JwtSigner;
};

// 7 days
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
export async function handleRegister(ctx: AuthContext<{
  username: string;
  email: string;
  password: string;
}>) {
  const { body, jwt, set, cookie: { auth_token } } = ctx;
  if (auth_token === undefined) throw new Error("auth token is undefined")
  const { username, email, password } = body;

  if (process.env.ENV === "DEV") {
    console.assert(typeof username === "string");
    console.assert(username !== "");
    console.assert(typeof email === "string");
    console.assert(email !== "");
    console.assert(typeof password === "string");
    console.assert(password !== "");
  }

  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {

    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning()!;
  console.assert(newUser.length > 0)

  if (process.env.ENV === "DEV") {
    console.assert(!!newUser[0]);
    console.assert(typeof newUser[0]!.id === "number");
    console.assert(newUser[0]!.id >= 0);
    console.assert(typeof newUser[0]!.username === "string");
    console.assert(newUser[0]!.username !== "");
    console.assert(typeof newUser[0]!.email === "string");
    console.assert(newUser[0]!.email !== "");
  }

  const token = await jwt.sign({ userId: newUser[0]!.id });

  if (process.env.ENV === "DEV") {
    console.assert(typeof token === "string");
    console.assert(token !== "");
  }

  auth_token.set({
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });

  set.status = 201;
  return { id: newUser[0]!.id, username: newUser[0]!.username, email: newUser[0]!.email };

}

export async function handleLogin(ctx: AuthContext<{
  email: string;
  password: string;
}>) {
  const { body, jwt, set, cookie: { auth_token } } = ctx;
  if (auth_token === undefined) throw new Error("auth token is undefined")

  const { email, password } = body;

  if (process.env.ENV === "DEV") {
    console.assert(typeof email === "string");
    console.assert(email !== "");
    console.assert(typeof password === "string");
    console.assert(password !== "");
  }

  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { errors: ["Invalid email or password"] };
  }

  assertUser(user);

  const token = await jwt.sign({ userId: user.id });

  if (process.env.ENV === "DEV") {
    console.assert(typeof token === "string");
    console.assert(token !== "");
  }

  auth_token.set({
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;

  if (process.env.ENV === "DEV") {
    console.assert(typeof title === "string");
    console.assert(title !== "");
    console.assert(description === undefined || typeof description === "string");
    console.assert(Array.isArray(outcomes));
    console.assert(outcomes.length >= 2);
    for (const o of outcomes) {
      console.assert(typeof o === "string");
      console.assert(o !== "");
    }
  }

  assertUser(user);

  if (user.role !== "admin") {
    set.status = 401;
    return { errors: ["unauthorized to create a market"] }
  }
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();
  console.assert(market.length > 0)

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0]!.id,
        title,
        position: index,
      })),
    )
    .returning();

  if (process.env.ENV === "DEV") {
    assertMarket(market[0]!);
    console.assert(outcomeIds.length === outcomes.length);
    for (const o of outcomeIds) {
      assertOutcome(o);
      console.assert(o.marketId === market[0]!.id);
    }
  }

  set.status = 201;
  const newMarket = market[0]!
  broadcastNewMarket({
    ...newMarket,
    creator: user,
    outcomes: []
  })

  return {
    id: market[0]!.id,
    title: market[0]!.title,
    description: market[0]!.description,
    status: market[0]!.status,
    outcomes: outcomeIds,
  };
}

export const PAGE_LIMIT = 20

export async function handleListMarkets({ query, set }: {
  query: {
    status?: string, page: number, sort: SORT_BY_OPTION[],

  },
  set: { status: number };

}) {
  const statusFilter: "active" | "resolved" =
    query.status === "resolved" ? "resolved" : "active";

  let hasDateAsc = false;
  let hasDateDesc = false;
  let hasNumPartAsc = false;
  let hasNumPartDesc = false;
  let hasTotalBetAsc = false;
  let hasTotalBetDesc = false;

  for (const opt of query.sort) {
    switch (opt) {
      case SORT_BY_OPTION.DateAsc: hasDateAsc = true; break;
      case SORT_BY_OPTION.DateDesc: hasDateDesc = true; break;
      case SORT_BY_OPTION.NumOfParticipantsAsc: hasNumPartAsc = true; break;
      case SORT_BY_OPTION.NumOfParticipantsDesc: hasNumPartDesc = true; break;
      case SORT_BY_OPTION.TotalBetSizeAsc: hasTotalBetAsc = true; break;
      case SORT_BY_OPTION.TotalBetSizeDesc: hasTotalBetDesc = true; break;
    }
  }

  //router should've rejected the request already before reaching this point for these bad conditions
  console.assert(!(hasDateAsc && hasDateDesc), "Date sort conflict");
  console.assert(!(hasNumPartAsc && hasNumPartDesc), "Participants sort conflict");
  console.assert(!(hasTotalBetAsc && hasTotalBetDesc), "Total bet size sort conflict");


  const orderBy: SQL[] = [];
  if (hasDateAsc) orderBy.push(asc(marketsTable.createdAt));
  if (hasDateDesc) orderBy.push(desc(marketsTable.createdAt));
  if (hasTotalBetAsc) orderBy.push(asc(sum(betsTable.amount)));
  if (hasTotalBetDesc) orderBy.push(desc(sum(betsTable.amount)));
  if (hasNumPartAsc) orderBy.push(asc(countDistinct(betsTable.userId)));
  if (hasNumPartDesc) orderBy.push(desc(countDistinct(betsTable.userId)));
  if (orderBy.length === 0) orderBy.push(desc(marketsTable.createdAt));

  const markets = await db.select({
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
    .orderBy(...orderBy as [SQL, ...SQL[]])
    .limit(PAGE_LIMIT)
    .offset(query.page * PAGE_LIMIT)

  const marketIds = markets.map((m) => m.id)

  const outcomes = marketIds.length > 0
    ? await db.select({
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

  const totalCount = await db.select({ count: count() })
    .from(marketsTable)
    .where(eq(marketsTable.status, statusFilter));

  const totalPages = totalCount !== undefined && totalCount[0] !== undefined
    ? Math.ceil(totalCount[0].count / PAGE_LIMIT)
    : 0;

  const enrichedMarkets = markets.map((m) => {
    const currOutcomes = outcomes.filter((o) => o.marketId === m.id);
    const totalMarketBets = Number(m.totalBetSize) ?? 0;
    return {
      id: m.id,
      title: m.title,
      status: m.status,
      creator: m.creatorUsername,
      totalMarketBets,
      outcomes: currOutcomes.map((o) => ({
        id: o.id,
        title: o.title,
        totalBets: Number(o.totalBets) || 0,
        odds: totalMarketBets > 0 ? Number(((Number(o.totalBets) / totalMarketBets) * 100).toFixed(2)) : 0,
      })),
    };
  });

  if (process.env.ENV === "DEV") {
    console.assert(!Number.isNaN(totalPages));
    console.assert(totalPages >= 0);

    for (const m of enrichedMarkets) {
      console.assert(!!m);
      console.assert(typeof m.id === "number");
      console.assert(m.id >= 0);
      console.assert(typeof m.title === "string");
      console.assert(m.title !== "");
      console.assert(m.status === "active" || m.status === "resolved");
      console.assert(typeof m.creator === "string");
      console.assert(m.creator !== "");
      console.assert(typeof m.totalMarketBets === "number");
      console.assert(m.totalMarketBets >= 0);
      console.assert(Array.isArray(m.outcomes));
      for (const o of m.outcomes) {
        assertEnrichedOutcome(o);
      }
    }
  }

  return { totalPages, markets: enrichedMarkets };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  if (process.env.ENV === "DEV") {
    console.assert(typeof params.id === "number");
    console.assert(params.id >= 0);
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { errors: ["Market not found"] };
  }

  if (process.env.ENV === "DEV") {
    assertMarket(market);
    console.assert(!!market.creator);
    console.assert(typeof market.creator.username === "string");
    console.assert(market.creator.username !== "");
    console.assert(Array.isArray(market.outcomes));
    for (const o of market.outcomes) {
      assertOutcome(o);
    }
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);

      if (process.env.ENV === "DEV") {
        console.assert(typeof totalAmount === "number");
        console.assert(totalAmount >= 0);
      }

      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  if (process.env.ENV === "DEV") {
    console.assert(typeof totalMarketBets === "number");
    console.assert(totalMarketBets >= 0);
  }

  const result = {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      if (process.env.ENV === "DEV") {
        assertEnrichedOutcome({ id: outcome.id, title: outcome.title, totalBets: outcomeBets, odds });
      }

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };

  return result;
}


export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;

  if (process.env.ENV === "DEV") {
    console.assert(typeof marketId === "number");
    console.assert(marketId >= 0);
    console.assert(typeof outcomeId === "number");
    console.assert(outcomeId >= 0);
    console.assert(typeof amount === "number");
    console.assert(amount > 0);
  }

  assertUser(user);

  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
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

  const userAlreadyBet = await db.query.betsTable.findFirst({
    where: and(eq(betsTable.userId, user.id), eq(betsTable.marketId, marketId)),
  })

  if (userAlreadyBet && userAlreadyBet.outcomeId !== outcomeId) {
    set.status = 400;
    return { errors: ["You cannot bet on multiple outcomes"] };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { errors: ["Outcome not found"] };
  }

  if (process.env.ENV === "DEV") {
    assertMarket(market);
    assertOutcome(outcome);
    console.assert(outcome.marketId === marketId);
  }

  const bet = await db
    .insert(betsTable)
    .values({
      userId: user.id,
      marketId,
      outcomeId,
      amount: Number(amount),
    })
    .returning();
  console.assert(bet.length > 0)

  if (process.env.ENV === "DEV") {
    assertBet(bet[0]!);
    console.assert(bet[0]!.userId === user.id);
    console.assert(bet[0]!.marketId === marketId);
    console.assert(bet[0]!.outcomeId === outcomeId);
    console.assert(bet[0]!.amount === Number(amount));
  }

  set.status = 201;
  broadcastSingleMarketUpdate(market.id)
  return {
    id: bet[0]!.id,
    userId: bet[0]!.userId,
    marketId: bet[0]!.marketId,
    outcomeId: bet[0]!.outcomeId,
    amount: bet[0]!.amount,
  };
}

export async function handleCloseMarket({ body, params, set, user }: {
  params: { id: number },
  body: { resolvedOutcomeId: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect
}) {
  if (process.env.ENV === "DEV") {
    console.assert(typeof params.id === "number");
    console.assert(params.id >= 0);
    console.assert(typeof body.resolvedOutcomeId === "number");
    console.assert(body.resolvedOutcomeId >= 0);
  }

  assertUser(user);

  if (user.role !== "admin") {
    set.status = 401;
    return { errors: ["unauthorized to close a market"] };
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
    console.assert(Array.isArray(market.outcomes));
    console.assert(market.outcomes.length > 0);
    for (const o of market.outcomes) {
      assertOutcome(o);
    }
  }

  const validOutcome = market.outcomes.find((o) => o.id === body.resolvedOutcomeId);
  if (!validOutcome) {
    set.status = 400;
    return { errors: ["Outcome does not belong to this market"] };
  }

  const updated = await db
    .update(marketsTable)
    .set({ status: "resolved", resolvedOutcomeId: body.resolvedOutcomeId })
    .where(eq(marketsTable.id, params.id))
    .returning();

  console.assert(updated.length > 0);

  if (process.env.ENV === "DEV") {
    console.assert(!!updated[0]);
    console.assert(typeof updated[0]!.id === "number");
    console.assert(updated[0]!.id >= 0);
    console.assert(updated[0]!.status === "resolved");
    console.assert(updated[0]!.resolvedOutcomeId === body.resolvedOutcomeId);
    console.assert(typeof updated[0]!.title === "string");
    console.assert(updated[0]!.title !== "");
  }

  broadcastSingleMarketUpdate(params.id);

  return {
    id: updated[0]!.id,
    title: updated[0]!.title,
    status: updated[0]!.status,
    resolvedOutcomeId: updated[0]!.resolvedOutcomeId,
  };
}