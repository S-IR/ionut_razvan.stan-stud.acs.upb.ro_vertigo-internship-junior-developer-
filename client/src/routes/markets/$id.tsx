import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market, ESMarketEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Router } from "lucide-react";
import { LabelList, Pie, PieChart } from "recharts";
import { toast } from "sonner"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { assert } from "@/lib/utils";
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const market = Route.useLoaderData();
  const router = useRouter();

  assert(!!market.outcomes && market.outcomes.length > 0)
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(
    market?.outcomes?.length > 0 ? market.outcomes[0].id : null
  );
  useEffect(() => {
    setSelectedOutcomeId(market?.outcomes?.length > 0 ? market.outcomes[0].id : null)
  }, [market.outcomes]);

  const [betAmount, setBetAmount] = useState("");

  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isBetting, setIsBetting] = useState(false);
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {

    const check = () => setIsSmall(window.innerWidth <= 650);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  useEffect(() => {
    const es = api.sseMarkets(id);

    const handleUpdate = async (e: MessageEvent) => {
      const { id: idFromWS } = JSON.parse(e.data);

      if (idFromWS === id) {
        router.invalidate();
      }
    };

    es.addEventListener(ESMarketEvent.MarketUpdated, handleUpdate);

    es.onerror = (e) => {
      console.error("SSE error", e);
    };
    return () => {
      es.removeEventListener(ESMarketEvent.MarketUpdated, handleUpdate);
      es.close();
    };
  }, [id]);

  const chartData = useMemo(() => {
    return market.outcomes.map((outcome) => ({
      outcome: outcome.title.toLowerCase().replace(/\s+/g, "-"),
      percentage: outcome.totalBets,
      fill: `var(--color-${outcome.title.toLowerCase().replace(/\s+/g, "-")})`,
    }));
  }, [market.outcomes]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      percentage: {
        label: "Bets",
      },
    };
    market.outcomes.forEach((outcome, index) => {
      const key = outcome.title.toLowerCase().replace(/\s+/g, "-");
      config[key] = {
        label: outcome.title,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [market.outcomes]);



  const handlePlaceBet = async () => {
    setError(null);

    if (!selectedOutcomeId) {
      setError("Please select an outcome");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid positive amount");
      return;
    }

    try {
      setIsBetting(true);
      await api.placeBet(market.id, selectedOutcomeId, amount).then(() => {
        router.invalidate()
        setBetAmount("");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to place bet"
      setError(msg)
      // setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setIsBetting(false);
    }
  };

  async function closeMarket() {
    if (selectedOutcomeId === null) {
      setError("please select an outcome before proceeding to close the market")
      return
    }
    try {
      api.closeMarket(id, selectedOutcomeId).then(() => router.invalidate())
    } catch (error) {
      toast("could not close the market. please try again later")
    }
  }
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card>
          <CardContent className="flex flex-col justify-center items-center gap-4 py-12">
            <p className="text-muted-foreground">Please log in to view this market</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const selectedOutcome = market.outcomes.find((o) => o.id === selectedOutcomeId);
  // if (isLoading) {
  //   return (
  //     <div className="flex justify-center items-center w-full min-h-screen">
  //       <div className="border-4 border-primary/20 border-t-primary rounded-full w-12 h-12 animate-spin" />
  //     </div>
  //   );
  // }
  return (
    <div className="min-h-screen">
      <div className="mx-auto px-4 py-8 max-w-3xl">
        {/* Back Button */}
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

        </Link>

        {/* Market Header */}
        <Card className="relative mb-6">
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="mt-2">{market.description}</CardDescription>
                )}
                {market.creator && (
                  <p className="mt-2 text-muted-foreground text-xs">
                    Created by <span className="text -foreground">{market.creator}</span>
                  </p>
                )}
              </div>
              <Badge className="top-2 left-2 absolute rounded-md! w-16! h-6!" variant={market.status === "active" ? "default" : "secondary"}>
                {market.status === "active" ? "Active" : "Resolved"}
              </Badge>
              {user?.role === "admin" &&
                <Button onClick={closeMarket} variant={"cyan"}>
                  Close Market
                </Button>
              }
            </div>
          </CardHeader>
        </Card>

        <div className="gap-6 grid md:grid-cols-2">
          {/* Chart Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bet Distribution</CardTitle>
              <CardDescription>Percentage of total bets per outcome</CardDescription>
            </CardHeader>
            <CardContent>
              {market.totalMarketBets === 0 ?
                <div>0 bets have been placed</div>
                :
                <ChartContainer
                  config={chartConfig}
                  className="[&_.recharts-text]:fill-foreground mx-auto max-h-[250px] aspect-square"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="outcome"
                          formatter={(value, name) => {
                            const total = market.totalMarketBets;
                            const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0;
                            return `${pct}% ($${Number(value).toLocaleString()})`;
                          }}
                        />
                      }
                    />
                    <Pie
                      data={chartData}
                      dataKey="percentage"
                      nameKey="outcome"
                      cornerRadius={8}
                      paddingAngle={4}
                      innerRadius={isSmall ? 10 : 30}
                    // outerRadius={isSmall ? 100 : 80}
                    >
                      <LabelList
                        dataKey="percentage"
                        stroke="none"
                        fontSize={12}
                        fontWeight={500}
                        fill="currentColor"
                        formatter={(value) => {
                          const total = market.totalMarketBets;
                          const num = Number(value) || 0;
                          return total > 0 ? `${((num / total) * 100).toFixed(0)}%` : "0%";
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>

              }

              {/* Legend */}
              <div className="flex justify-center gap-4 mt-4">
                {market.outcomes.map((outcome, index) => (
                  <div key={outcome.id} className="flex items-center gap-2">
                    <div
                      className="rounded-sm w-3 h-3"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground text-sm">{outcome.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Odds Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current Odds</CardTitle>
              <CardDescription>Real-time odds for each outcome</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {market.outcomes.map((outcome, index) => (
                <button
                  key={outcome.id}
                  className={`p-3 w-full rounded-lg border transition-colors cursor-pointer ${selectedOutcomeId === outcome.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                    }`}
                  onClick={() => market.status === "active" && setSelectedOutcomeId(outcome.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-sm w-2.5 h-2.5"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="font-medium text-sm">{outcome.title}</span>
                      <span className="from-teal-200 font-medium text-xs">odds: {outcome.odds} </span>

                    </div>
                    <span className="font-bold text-xl">{outcome.odds}</span>
                  </div>
                  <p className="mt-1 ml-4 text-muted-foreground text-xs">
                    ${outcome.totalBets.toLocaleString()} in bets
                  </p>
                </button>
              ))}

              {/* Total Market Value */}
              <div className="pt-3 border-border border-t">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total Market Value</span>
                  <span className="font-bold text-lg">${market.totalMarketBets.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Betting Section */}
        {market.status === "active" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Place a Bet</CardTitle>
              <CardDescription>Select an outcome above and enter your bet amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 px-4 py-3 border border-destructive/20 rounded-md text-destructive-foreground text-sm">
                  {error}
                </div>
              )}

              <div className="gap-4 grid sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Selected Outcome</Label>
                  <div className="bg-muted/50 p-3 border border-border rounded-md text-sm">
                    {selectedOutcome?.title || "None selected"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="betAmount">Amount ($)</Label>
                  <Input
                    id="betAmount"
                    type="number"
                    step="0.01"
                    min="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="1.00"
                    disabled={isBetting}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handlePlaceBet}
                disabled={isBetting || !selectedOutcomeId || !betAmount}
              >
                {isBetting ? "Placing Bet..." : "Place Bet"}
              </Button>
            </CardContent>
          </Card>
        )}

        {market.status === "resolved" && (
          <Card className="mt-6">
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground">This market has been resolved.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,

  params: {
    parse: (params) => {
      const id = Number(params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw redirect({ to: "/markets/not-found" });
      }

      return { id };
    },
  },


  loader: async ({ params }) => {
    try {
      return await api.getMarket(params.id);
    } catch (error) {
      console.log(error)
      throw redirect({ to: "/server-error" })
    }
  },
});
