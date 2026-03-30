import { useNavigate } from "@tanstack/react-router";
import type { Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MarketCardProps {
  market: Market;
}
export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();

  const displayedOutcomes = market.outcomes.slice(0, 4);
  const remaining = market.outcomes.length - 4;

  return (
    <div onClick={() => navigate({ to: `/markets/${market.id}` })} className="cursor-pointer">
      <Card className="flex flex-col hover:bg-stone-900 shadow-xl hover:shadow-none w-full md:w-auto h-[420px] sm:h-[460px] transition-all duration-300">
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="md:text-xl! text-lg line-clamp-2">{market.title}</CardTitle>
              <CardDescription className="truncate">
                By: {market.creator || "Unknown"}
              </CardDescription>
            </div>

            <Badge
              className="invisible rounded-md! w-16! h-6! md:visible!"
              variant={market.status === "active" ? "default" : "secondary"}
            >
              {market.status === "active" ? "Active" : "Resolved"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 justify-between space-y-4">
          <div className="space-y-2">
            {displayedOutcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="flex justify-between items-center bg-secondary/20 p-3 rounded-md"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{outcome.title}</p>
                  <p className="text-muted-foreground text-xs">
                    ${outcome.totalBets.toFixed(2)} total
                  </p>
                </div>

                <p className="font-bold text-lg">{outcome.odds}%</p>
              </div>
            ))}

            {remaining > 0 && (
              <p className="text-muted-foreground text-xs text-center">
                +{remaining} more outcomes
              </p>
            )}
          </div>

          <div className="bg-primary/5 p-3 border border-primary/20 rounded-md">
            <p className="text-muted-foreground text-xs">Total Market Value</p>
            <p className="font-bold text-primary text-2xl">${market.totalMarketBets.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
