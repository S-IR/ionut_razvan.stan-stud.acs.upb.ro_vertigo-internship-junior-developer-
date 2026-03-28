import { Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl">{market.title}</CardTitle>
            <CardDescription>By: {market.creator || "Unknown"}</CardDescription>
          </div>
          <Badge variant={market.status === "active" ? "default" : "secondary"}>
            {market.status === "active" ? "Active" : "Resolved"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Outcomes */}
        <div className="space-y-2">
          {market.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex justify-between items-center bg-secondary/20 p-3 rounded-md"
            >
              <div>
                <p className="font-medium text-sm">{outcome.title}</p>
                <p className="text-muted-foreground text-xs">
                  ${outcome.totalBets.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{outcome.odds}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total Market Value */}
        <div className="bg-primary/5 p-3 border border-primary/20 rounded-md">
          <p className="text-muted-foreground text-xs">Total Market Value</p>
          <p className="font-bold text-primary text-2xl">${market.totalMarketBets.toFixed(2)}</p>
        </div>

        {/* Action Button */}
        <Button className="w-full" onClick={() => navigate({ to: `/markets/${market.id}` })}>
          {market.status === "active" ? "Place Bet" : "View Results"}
        </Button>
      </CardContent>
    </Card>
  );
}
