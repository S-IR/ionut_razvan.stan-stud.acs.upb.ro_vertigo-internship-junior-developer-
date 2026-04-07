import { describe, it, expect, beforeAll } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { app } from "../index";
import { eq } from "drizzle-orm";
import db from "../src/db";
import { usersTable } from "../src/db/schema";

const BASE = "http://localhost";

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
let adminAuthCookie: string;
let adminId: number;

beforeAll(async () => {
  migrate(db, { migrationsFolder: "./drizzle" });
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
    const data = (await res.json()) as any;
    expect(data.id).toBeDefined();
    expect(data.username).toBe(username);
    expect(data.email).toBe(email);
    expect(data.passwordHash).toBe(undefined);
    expect(data.password).toBe(undefined);

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
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
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
    const data = (await res.json()) as any;
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
    const data = (await res.json()) as any;
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
    const data = (await res.json()) as any;
    expect(data).toBeDefined();
  });

  it("creates test admin user (via DB role update) and logs in", async () => {
    const adminUsername = "testadmin";
    const adminEmail = "admin@example.com";
    const adminPassword = "adminpass123";

    const registerRes = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, email: adminEmail, password: adminPassword }),
      }),
    );
    expect(registerRes.status).toBe(201);
    const registerData = (await registerRes.json()) as any;
    adminId = registerData.id;

    await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, adminId));

    const loginRes = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      }),
    );
    expect(loginRes.status).toBe(200);
    adminAuthCookie = getCookie(loginRes, "auth_token")!;
    expect(adminAuthCookie).toBeDefined();
  });

  it("GET /api/auth/me — returns current user when authenticated", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/me`, {
        headers: { Cookie: `auth_token=${authCookie}` },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(userId);
    expect(data.username).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.role).toBeDefined();
    expect("passwordHash" in data).toBe(false);
  });

  it("GET /api/auth/me — requires auth", async () => {
    const res = await app.handle(new Request(`${BASE}/api/auth/me`));
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
  });

  it("POST /api/auth/logout — clears auth cookie", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: `auth_token=${authCookie}` },
      }),
    );
    expect(res.status).toBe(200);
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
    expect(res.status).toBe(401);
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
    const data = (await res.json()) as any;
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
    const data = (await res.json()) as any;
    expect(data.errors?.length).toBeGreaterThan(0);
  });

  it("GET /api/markets/public — lists markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;

    expect(Array.isArray(data.markets)).toBe(true);
    expect(data.markets.length).toBeGreaterThan(0);
  });

  it("GET /api/markets/public/:id — returns market detail", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public/${marketId}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(marketId);
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.description).toBe("Weather prediction");
    expect(data.outcomes).toHaveLength(2);
  });

  it("GET /api/markets/public/:id — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/public/99999`));
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
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
    const data = (await res.json()) as any;
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
    const data = (await res.json()) as any;
    expect(data.errors?.length).toBeGreaterThan(0);
  });

  it("POST /api/markets/public/:id/bets — rejects bets from admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/public/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminAuthCookie}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      }),
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data).toBeDefined();
  });
});

describe("Admin Market Closure", () => {
  it("POST /api/markets/:id/close — requires admin role (regular user gets 401)", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${authCookie}`,
        },
        body: JSON.stringify({ resolvedOutcomeId: outcomeId }),
      }),
    );
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
  });

  it("POST /api/markets/:id/close — rejects unknown outcome id", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminAuthCookie}`,
        },
        body: JSON.stringify({ resolvedOutcomeId: 99999 }),
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
  });

  it("POST /api/markets/:id/close — closes active market as admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminAuthCookie}`,
        },
        body: JSON.stringify({ resolvedOutcomeId: outcomeId }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(marketId);
    expect(data.status).toBe("resolved");
    expect(data.resolvedOutcomeId).toBe(outcomeId);
  });

  it("POST /api/markets/:id/close — 404 for nonexistent market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/99999/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminAuthCookie}`,
        },
        body: JSON.stringify({ resolvedOutcomeId: 1 }),
      }),
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
  });
});

describe("Users API", () => {
  it("GET /api/users/leaderboards — returns paginated leaderboard", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/leaderboards?page=0`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.topUsers)).toBe(true);
    expect(typeof data.totalPages).toBe("number");
  });

  it("GET /api/users/:id — returns user profile", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/${userId}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(userId);
    expect(data.username).toBeDefined();
    expect(data.role).toBeDefined();
  });

  it("GET /api/users/:id — 404 for unknown user", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/99999`));
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data).toBeDefined()
  });

  it("GET /api/users/bets/:id — returns user bets (with optional status filter)", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/bets/${userId}?page=0`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.bets)).toBe(true);
    expect(typeof data.totalPages).toBe("number");
  });

  it("GET /api/users/markets/:id — returns user-created markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/markets/${userId}?page=0`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.markets)).toBe(true);
    expect(typeof data.totalPages).toBe("number");
  });

  it("GET /api/users/api-keys — requires auth (lists user API keys)", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/users/api-keys`, {
        headers: { Cookie: `auth_token=${authCookie}` },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.keys)).toBe(true);
    expect(typeof data.totalPages).toBe("number");
  });
});

describe("Error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.handle(new Request(`${BASE}/nonexistent`));
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toBe(undefined);

  });
});
