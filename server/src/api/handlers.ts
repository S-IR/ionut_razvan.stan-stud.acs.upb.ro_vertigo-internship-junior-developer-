import { eq, and, sum, countDistinct, asc, desc, inArray, SQL, count, } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";
import { assert } from "../lib/assert";
import { broadcastNewMarket, SORT_BY_OPTION } from "./markets.routes";
import { type Context } from "elysia";

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
  // if (!auth_token) return  { errors: [{ field: "auto", message: "User already exists" }] }
  if (auth_token === undefined) throw new Error("auth token is undefined")
  const { username, email, password } = body;
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
  assert(newUser.length > 0)

  const token = await jwt.sign({ userId: newUser[0]!.id });

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
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });
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
  assert(market.length > 0)
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
const MARKETS_DISPLAYED_PER_PAGE = 20

export async function handleListMarkets({ query }: { query: { status?: string, page: number, sort: SORT_BY_OPTION[] } }) {
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

  assert(!(hasDateAsc && hasDateDesc), "Date sort conflict");
  assert(!(hasNumPartAsc && hasNumPartDesc), "Participants sort conflict");
  assert(!(hasTotalBetAsc && hasTotalBetDesc), "Total bet size sort conflict");

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
    .limit(MARKETS_DISPLAYED_PER_PAGE)
    .offset(query.page * MARKETS_DISPLAYED_PER_PAGE)

  const marketIds = markets.map((m) => m.id)

  const outcomes = await db.select({
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


  // const markets = await db.query.marketsTable.findMany({
  //   where: eq(marketsTable.status, statusFilter),
  //   with: {
  //     creator: {
  //       columns: { username: true },
  //     },

  //     outcomes: {
  //       orderBy: (outcomes, { asc, desc }) => hasTotalBetDesc ? desc(outcomes.position) : asc(outcomes.position),
  //     },
  //   },
  //   orderBy: (markets, { desc, asc }) => hasDateAsc ? asc(markets.createdAt) : desc(markets.createdAt),
  //   limit: MARKETS_DISPLAYED_PER_PAGE,
  //   offset: query.page * MARKETS_DISPLAYED_PER_PAGE,
  // });

  // id: outcome.id,
  //           title: outcome.title,
  //           odds,
  //           totalBets: outcomeBets,

  const totalCount = await db.select({ count: count() })
    .from(marketsTable)
    .where(eq(marketsTable.status, statusFilter));

  const totalPages = totalCount !== undefined && totalCount[0] !== undefined ? Math.ceil(totalCount[0].count / MARKETS_DISPLAYED_PER_PAGE) : 0;

  const enrichedMarkets = markets.map((m) => {
    const currOutcomes = outcomes.filter((o) => o.marketId === m.id);
    const totalMarketBets = Number(m.totalBetSize) ?? 0
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

    // return {
    //   ...m, outcomes: {
    //     id: outcome?.id
    //   title: outcome?.title,

    //   }
    // }
  })

  return { totalPages, markets: enrichedMarkets };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
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
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
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
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
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
  assert(bet.length > 0)
  set.status = 201;
  return {
    id: bet[0]!.id,
    userId: bet[0]!.userId,
    marketId: bet[0]!.marketId,
    outcomeId: bet[0]!.outcomeId,
    amount: bet[0]!.amount,
  };
}
