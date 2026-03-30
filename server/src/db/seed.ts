import { Database } from "bun:sqlite";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { hashPassword } from "../lib/auth";

const db = drizzle(
  new Database(process.env.DB_FILE_NAME || "database.sqlite"),
  {
    schema,
  },
);

const USER_COUNT = 5_000;
const MARKET_COUNT = 3_000;
const SHARED_PASSWORD = "password123";
const USER_INSERT_BATCH_SIZE = 250;
const BET_INSERT_BATCH_SIZE = 1_000;
const MARKET_CATEGORIES = [
  "crypto",
  "sports",
  "politics",
  "business",
  "science",
  "weather",
] as const;
const YES_NO_OUTCOMES = ["Yes", "No"];
const MARKET_STATUS_OPTIONS = [
  "active",
  "active",
  "active",
  "resolved",
] as const;

type MarketStatus = (typeof MARKET_STATUS_OPTIONS)[number];

type UserInsert = typeof schema.usersTable.$inferInsert;
type UserRow = typeof schema.usersTable.$inferSelect;
type MarketInsert = typeof schema.marketsTable.$inferInsert;
type MarketOutcomeInsert = typeof schema.marketOutcomesTable.$inferInsert;
type BetInsert = typeof schema.betsTable.$inferInsert;

type SeededUser = {
  id: number;
  username: string;
  email: string;
  password: string;
  remainingBalance: number;
};

type GeneratedMarket = {
  title: string;
  description: string;
  status: MarketStatus;
  outcomes: string[];
};

type CreatedMarket = {
  id: number;
  title: string;
  status: MarketStatus;
  outcomeIds: number[];
};

faker.seed(20260311);

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function createRandomUser(runId: string, index: number): UserInsert {
  const sex = faker.person.sexType();
  const firstName = faker.person.firstName(sex);
  const lastName = faker.person.lastName();
  const usernameBase = `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  const username = `${usernameBase}.${runId}.${index}`;
  const email = faker.internet.email({
    firstName,
    lastName,
    provider: "seed.local",
  });
  const normalizedEmail =
    `${email.split("@")[0]}.${runId}.${index}@seed.local`.toLowerCase();

  return {
    username,
    email: normalizedEmail,
    passwordHash: "",
  };
}

function createMarketTitle(category: (typeof MARKET_CATEGORIES)[number]) {
  switch (category) {
    case "crypto":
      return `Will ${faker.finance.currencyCode()} trade above ${faker.number.int({ min: 20, max: 250 })} by ${faker.date
        .soon({ days: 180 })
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}?`;
    case "sports":
      return `Will the ${faker.helpers.arrayElement(["Lions", "Storm", "Falcons", "Tigers", "Sharks"])} win ${faker.helpers.arrayElement(["their next match", "the division", "the championship"])}?`;
    case "politics":
      return `Will ${faker.location.city()} approve ${faker.helpers.arrayElement(["the housing measure", "the transit bond", "the tax proposal", "the school budget"])} this year?`;
    case "business":
      return `Will ${faker.company.name()} launch ${faker.helpers.arrayElement(["an IPO", "a new AI product", "a mobile app", "a subscription tier"])} before Q${faker.number.int({ min: 2, max: 4 })}?`;
    case "science":
      return `Will ${faker.helpers.arrayElement(["fusion", "gene therapy", "battery tech", "space robotics"])} hit ${faker.helpers.arrayElement(["a public milestone", "commercial rollout", "regulatory approval", "a new record"])} this year?`;
    case "weather":
      return `Will ${faker.location.city()} record ${faker.helpers.arrayElement(["rain", "snow", "temperatures above 35C", "temperatures below -5C"])} this month?`;
  }
}

function createMarketDescription(category: (typeof MARKET_CATEGORIES)[number]) {
  switch (category) {
    case "crypto":
      return "Speculation on a major digital asset crossing a specific price target before the deadline.";
    case "sports":
      return "A sports market based on an upcoming result with plenty of fan-driven volume.";
    case "politics":
      return "A local politics market that resolves using the official public election or vote result.";
    case "business":
      return "A company milestone market focused on launches, capital events, or other business developments.";
    case "science":
      return "A research and innovation market driven by publicly reported breakthroughs and milestones.";
    case "weather":
      return "A weather market tied to publicly recorded local conditions over a defined time window.";
  }
}

function createMarketOutcomes(category: (typeof MARKET_CATEGORIES)[number]) {
  if (category === "sports") {
    return faker.helpers.arrayElement([
      ["Win", "Lose"],
      ["Yes", "No"],
      ["Win in regulation", "Win after overtime", "No win"],
    ]);
  }

  if (category === "politics") {
    return faker.helpers.arrayElement([
      ["Pass", "Fail"],
      ["Yes", "No"],
      ["Under 50%", "50%-60%", "Over 60%"],
    ]);
  }

  if (category === "crypto" || category === "business") {
    return faker.helpers.arrayElement([
      YES_NO_OUTCOMES,
      ["Below target", "Hits target", "Exceeds target"],
    ]);
  }

  return faker.helpers.arrayElement([
    YES_NO_OUTCOMES,
    ["Yes", "No", "Unclear"],
  ]);
}

function createRandomMarket(): GeneratedMarket {
  const category = faker.helpers.arrayElement(MARKET_CATEGORIES);

  return {
    title: createMarketTitle(category),
    description: createMarketDescription(category),
    status: faker.helpers.arrayElement(MARKET_STATUS_OPTIONS),
    outcomes: createMarketOutcomes(category),
  };
}

async function settleMarket(marketId: number, resolvedOutcomeId: number) {
  const allBets = await db.query.betsTable.findMany({
    where: eq(schema.betsTable.marketId, marketId),
  });

  const totalPool = allBets.reduce((s, b) => s + b.amount, 0);
  const winningBets = allBets.filter((b) => b.outcomeId === resolvedOutcomeId);
  const totalWinningStakes = winningBets.reduce((s, b) => s + b.amount, 0);

  if (totalPool > 0 && winningBets.length > 0) {
    await db.transaction(async (tx) => {
      await Promise.all(
        winningBets.map(async (bet) => {
          const payout = (bet.amount / totalWinningStakes) * totalPool;

          await tx
            .update(schema.betsTable)
            .set({ winnings: payout })
            .where(eq(schema.betsTable.id, bet.id));

          await tx
            .update(schema.usersTable)
            .set({ balance: sql`${schema.usersTable.balance} + ${payout}` })
            .where(eq(schema.usersTable.id, bet.userId));
        }),
      );
    });
  }

  await db
    .update(schema.marketsTable)
    .set({ status: "resolved", resolvedOutcomeId })
    .where(eq(schema.marketsTable.id, marketId));
}

async function deleteAllData() {
  await db.delete(schema.betsTable);
  await db.delete(schema.marketOutcomesTable);
  await db.delete(schema.marketsTable);
  await db.delete(schema.usersTable);
}

async function insertUsers() {
  const passwordHash = await hashPassword(SHARED_PASSWORD);
  const runId = faker.string.alphanumeric({ length: 6, casing: "lower" });

  const userValues = Array.from({ length: USER_COUNT }, (_, index) => ({
    ...createRandomUser(runId, index + 1),
    passwordHash,
  }));

  const insertedUsers: UserRow[] = [];

  for (const batch of chunkArray(userValues, USER_INSERT_BATCH_SIZE)) {
    const created = await db
      .insert(schema.usersTable)
      .values(batch)
      .returning();
    insertedUsers.push(...created);
  }

  return insertedUsers.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    password: SHARED_PASSWORD,
    remainingBalance: faker.number.int({ min: 500, max: 10_000 }),
  }));
}

async function insertMarkets(users: SeededUser[]) {
  const createdMarkets: CreatedMarket[] = [];

  for (let index = 0; index < MARKET_COUNT; index++) {
    const marketData = createRandomMarket();
    const creator = faker.helpers.arrayElement(users);

    const [createdMarket] = await db
      .insert(schema.marketsTable)
      .values({
        title: marketData.title,
        description: marketData.description,
        status: marketData.status,
        createdBy: creator.id,
      })
      .returning();

    const createdOutcomes = await db
      .insert(schema.marketOutcomesTable)
      .values(
        marketData.outcomes.map((title, position) => ({
          marketId: createdMarket.id,
          title,
          position,
        })),
      )
      .returning();

    createdMarkets.push({
      id: createdMarket.id,
      title: createdMarket.title,
      status: marketData.status,
      outcomeIds: createdOutcomes.map((o) => o.id),
    });
  }

  return createdMarkets;
}

function createBetAmount(user: SeededUser) {
  if (user.remainingBalance <= 5) return 0;
  return faker.number.int({
    min: 5,
    max: Math.min(user.remainingBalance, 250),
    multipleOf: 5,
  });
}

async function insertBets(users: SeededUser[], markets: CreatedMarket[]) {
  const betValues: BetInsert[] = [];

  for (const market of markets) {
    const participants = faker.helpers.arrayElements(
      users.filter((u) => u.remainingBalance >= 5),
      faker.number.int({ min: 8, max: 40 }),
    );

    for (const user of participants) {
      for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
        if (user.remainingBalance < 5) break;

        const amount = createBetAmount(user);
        if (amount < 5) break;

        betValues.push({
          userId: user.id,
          marketId: market.id,
          outcomeId: faker.helpers.arrayElement(market.outcomeIds),
          amount,
          createdAt: faker.date.between({
            from: new Date("2025-01-01"),
            to: new Date(),
          }),
        });

        user.remainingBalance -= amount;
      }
    }
  }

  for (const batch of chunkArray(betValues, BET_INSERT_BATCH_SIZE)) {
    await db.insert(schema.betsTable).values(batch);
  }

  return betValues.length;
}

async function seedDatabase() {
  const users = await insertUsers();
  const createdMarkets = await insertMarkets(users);
  await insertBets(users, createdMarkets);

  for (const market of createdMarkets) {
    if (market.status === "resolved") {
      const resolvedOutcomeId = faker.helpers.arrayElement(market.outcomeIds);
      await settleMarket(market.id, resolvedOutcomeId);
    }
  }
}

async function main() {
  const command = process.argv[2];

  if (command === "reset") {
    await deleteAllData();
    await seedDatabase();
  } else if (command === "seed") {
    await seedDatabase();
  } else if (command === "delete") {
    await deleteAllData();
  }
}

main().catch(console.error);
