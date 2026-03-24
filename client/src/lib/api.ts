
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved";
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
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
}

class ApiClient {
  public baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
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
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
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

  async me(): Promise<User> {
    return this.request("/api/auth/me");
  }

  async logout(): Promise<void> {
    return this.request("/api/auth/logout", { method: "POST" });
  }

  async listMarkets(status: "active" | "resolved" = "active", page: number, sortOptions: MARKETS_SORT_BY_OPTION[]): Promise<{ totalPages: number; markets: Market[] }> {
    const params = new URLSearchParams({ status, page: page.toString() });
    sortOptions.forEach(opt => params.append("sort", opt));
    return this.request(`/api/markets?${params.toString()}`);
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    console.assert(amount != 0)

    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  async closeMarket(marketId: number, outcomeId: number): Promise<Bet> {
    // console.assert(amount != 0)

    return this.request(`/api/markets/${marketId}/close`, {
      method: "POST",
      body: JSON.stringify({ resolvedOutcomeId: outcomeId }),
    });
  }

  async getUserBets(id: number, extraOptions: RequestInit = {}): Promise<BetWithDetails[]> {

    try {
      return this.request(`/api/users/bets/${id}`, extraOptions)
    } catch (e) {
      throw new Error(`${e}`)
    }

  }
}

export const api = new ApiClient(API_BASE_URL);