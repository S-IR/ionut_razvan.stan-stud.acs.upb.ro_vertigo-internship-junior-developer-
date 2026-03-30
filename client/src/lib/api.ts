
import { assert } from "../lib/utils"
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const LISTEN_TO_ALL_UPDATES_ID = -1

export interface Market {
  id: number;
  title: string;
  description?: string;
  status: MarketStatus;
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
}
export const MarketStatuses = ["active", "resolved"] as const
export type MarketStatus = typeof MarketStatuses[number]
export interface MarketWithoutOutcomes {
  totalBetSize: number;
  id: number;
  title: string;
  description: string | null;
  status: MarketStatus;
  createdAt: Date;
  resolvedOutcomeId: number | null;
  numParticipants: number;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
  balance: number;
  username: string;
  email: string;
  role: "admin" | "normal"
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}
export interface APIKey {
  id: number;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}
export enum MARKETS_SORT_BY_OPTION {
  DateAsc = "DateAscending",
  DateDesc = "DateDescending",
  TotalBetSizeAsc = "TotalBetSizeAscending",
  TotalBetSizeDesc = "TotalBetSizeDescending",
  NumOfParticipantsAsc = "NumOfParticipantsAscending",
  NumOfParticipantsDesc = "NumOfParticipantsDescending"
}
export type BetWithDetails = Bet & {
  market: Market & { resolvedOutcomeId: number | null };
  outcome: MarketOutcome;
  status: "won" | "lost" | "ongoing"
}
export enum ESMarketEvent {
  NewMarket = "new-market",
  MarketUpdated = "market-updated"
}
export enum ESUserEvent {
  UserUpdated = "user-updated",
  NewBet = "bet-new"
}

interface LeaderboardUser {
  id: number;
  username: string;
  totalWinnings: number | null;
}
export class APIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const BET_STATUSES = ["ongoing", "won", "lost"] as const
export type BetStatus = typeof BET_STATUSES[number]
class ApiClient {
  public baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    startRequest();

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.errors && Array.isArray(data.errors)) {
          throw new APIError(data.errors.join(", "), response.status);
        }

        if (data?.message) {
          throw new APIError(data.message, response.status);
        }

        throw new APIError("Unknown error", response.status);
      }

      return data ?? {};
    } finally {
      endRequest();
    }
  }

  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async me(options?: RequestInit): Promise<User> {
    return this.request("/api/auth/me", options);
  }


  async getUser(id: number): Promise<User> {
    return this.request(`/api/users/${encodeURIComponent(id.toString())}`);
  }
  async logout(): Promise<void> {
    return this.request("/api/auth/logout", { method: "POST" });
  }

  async listMarkets(status: MarketStatus = "active", page: number, sortOptions: MARKETS_SORT_BY_OPTION[]): Promise<{ totalPages: number; markets: Market[] }> {
    const params = new URLSearchParams({ status, page: page.toString() });
    sortOptions.forEach(opt => params.append("sort", opt));
    return this.request(`/api/markets/public?${params.toString()}`);
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/public/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets/public", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    assert(amount != 0)

    return this.request(`/api/markets/public/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  async closeMarket(marketId: number, outcomeId: number): Promise<Bet> {
    // assert(amount != 0)

    return this.request(`/api/markets/${marketId}/close`, {
      method: "POST",
      body: JSON.stringify({ resolvedOutcomeId: outcomeId }),
    });
  }

  async getUserBets(id: number, page: number, status?: BetStatus, extraOptions: RequestInit = {}): Promise<{ bets: BetWithDetails[], totalPages: number }> {
    assert(page >= 0)

    const params = new URLSearchParams({ page: page.toString() });

    if (status) {
      params.append("status", status)
    }
    return this.request(`/api/users/bets/${id}?${params.toString()}`, extraOptions)
  }


  async getUserMarkets(id: number, page: number, status?: Market["status"], extraOptions: RequestInit = {}): Promise<{ markets: MarketWithoutOutcomes[], totalPages: number }> {
    assert(page >= 0)

    const params = new URLSearchParams({ page: page.toString() });

    if (status) {
      params.append("status", status)
    }
    return this.request(`/api/users/markets/${id}?${params.toString()}`, extraOptions)
  }
  async getLeaderboards(page: number, extraOptions: RequestInit = {}): Promise<{ totalPages: number, topUsers: LeaderboardUser[] }> {
    return this.request(`/api/users/leaderboards?page=${encodeURIComponent(page)}`, extraOptions);

  }
  async getUserApiKeys(page: number, extraOptions: RequestInit = {}): Promise<{ keys: APIKey[], totalPages: number }> {
    assert(page >= 0)
    return this.request(`/api/users/api-keys?page=${encodeURIComponent(page)}`, extraOptions)
  }
  async createAPIKey(name: string, dateISOString: string): Promise<{ key: string }> {
    assert(name.length > 0)
    assert(dateISOString.length > 0)
    const expiresAt = new Date(dateISOString)
    assert(expiresAt && !isNaN(expiresAt.getTime()))
    assert(expiresAt > new Date())
    return this.request("/api/users/api-keys", {
      method: "POST",
      body: JSON.stringify({
        name, expiresAt
      })
    })
  }

  async deleteAPIKey(id: number) {
    return this.request(`/api/users/api-keys/${id}`, {
      method: "DELETE"
    })
  }

  sseMarkets(marketID?: number): EventSource {
    return new EventSource(
      `/api/markets/sse/${marketID !== undefined ? marketID : LISTEN_TO_ALL_UPDATES_ID}`
    );
  }
  sseUsers(userID?: number): EventSource {
    return new EventSource(
      `/api/users/sse/${userID !== undefined ? userID : LISTEN_TO_ALL_UPDATES_ID}`
    );
  }
}
let activeRequests = 0;
const listeners = new Set<(loading: boolean) => void>();

export function subscribe(cb: (loading: boolean) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify() {
  const isLoading = activeRequests > 0;
  listeners.forEach((l) => l(isLoading));
}

export function startRequest() {
  activeRequests++;
  notify();
}

export function endRequest() {
  activeRequests--;
  notify();
}
export const api = new ApiClient(API_BASE_URL);

