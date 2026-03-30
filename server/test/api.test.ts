import { describe, it, expect, beforeAll } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { app } from "../index"; // your main app entry
import db from "../src/db";

const BASE = "http://localhost";

// Helper to extract cookie value from Response
function getCookie(res: Response, name: string): string | undefined {
  const cookieHeader = res.headers.get("set-cookie");
  if (!cookieHeader) return undefined;

  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : undefined;
}

// Shared state (populated by earlier tests)
let authCookie: string;
let userId: number;
let marketId: number;
let outcomeId: number;

beforeAll(async () => {
  // Run migrations on the in-memory DB
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("Auth", () => {
  const username = "testuser";
  const email = "test@example.com";
  const password = "testpass123";

  it("POST /api/auth/register — creates a new user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.id).toBeDefined();
    expect(data.username).toBe(username);
    expect(data.email).toBe(email);

    // Extract cookie for future requests
    authCookie = getCookie(res, "auth_token")!;
    expect(authCookie).toBeDefined();

    userId = data.id;
  });

  it("POST /api/auth/register — rejects duplicate user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("POST /api/auth/register — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "bad", password: "12" }),
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.errors?.length).toBeGreaterThan(0);
  });

  it("POST /api/auth/login — logs in with valid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.id).toBe(userId);

    authCookie = getCookie(res, "auth_token")!;
    expect(authCookie).toBeDefined();
  });

  it("POST /api/auth/login — rejects invalid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("Markets", () => {
  it("POST /api/markets/public — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test market", outcomes: ["Yes", "No"] }),
      }),
    );
    expect(res.status).toBe(401); // or 400/unauthorized depending on your middleware
  });

  it("POST /api/markets/public — creates a market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${authCookie}`,
        },
        body: JSON.stringify({
          title: "Will it rain tomorrow?",
          description: "Weather prediction",
          outcomes: ["Yes", "No"],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.outcomes).toHaveLength(2);

    marketId = data.id;
    outcomeId = data.outcomes[0].id;
  });

  it("POST /api/markets/public — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${authCookie}`,
        },
        body: JSON.stringify({ title: "Hi", outcomes: ["Only one"] }),
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.errors?.length).toBeGreaterThan(0);
  });

  it("GET /api/markets/public — lists markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public`));
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(Array.isArray(data.markets)).toBe(true); // note: wrapped in { markets, totalPages }
    expect(data.markets.length).toBeGreaterThan(0);
  });

  it("GET /api/markets/public/:id — returns market detail", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public/${marketId}`));
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.id).toBe(marketId);
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.description).toBe("Weather prediction");
    expect(data.outcomes).toHaveLength(2);
  });

  it("GET /api/markets/public/:id — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public/99999`));
    expect(res.status).toBe(404);
  });
});

describe("Bets", () => {
  it("POST /api/markets/public/:id/bets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public/${marketId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, amount: 100 }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST /api/markets/public/:id/bets — places a bet", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${authCookie}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.id).toBeDefined();
    expect(data.userId).toBe(userId);
    expect(data.marketId).toBe(marketId);
    expect(data.outcomeId).toBe(outcomeId);
    expect(data.amount).toBe(50);
  });

  it("POST /api/markets/public/:id/bets — validates amount", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${authCookie}`,
        },
        body: JSON.stringify({ outcomeId, amount: -10 }),
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.errors?.length).toBeGreaterThan(0);
  });
});

describe("Error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.handle(new Request(`${BASE}/nonexistent`));
    expect(res.status).toBe(404);
    const data = await res.json() as any;
    expect(data.error).toBe(undefined);
  });
});