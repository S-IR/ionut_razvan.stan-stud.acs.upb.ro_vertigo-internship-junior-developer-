import { PaginationControl } from "./pagination";
import type { Market, MarketWithoutOutcomes } from "@/lib/api";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route } from "@/routes/users/$userID";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function MarketsList({
  markets,
  currentPage,
  totalPages,
  marketStatus,
}: {
  markets: Array<MarketWithoutOutcomes>;
  currentPage: number;
  totalPages: number;
  marketStatus: Market["status"] | undefined;
}) {
  const navigate = Route.useNavigate();

  if (markets.length === 0) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <p className="text-muted-foreground">No markets to display</p>
        </CardContent>
      </Card>
    );
  }

  function onPageChange(marketsPageValue: number) {
    navigate({ search: (prev) => ({ ...prev, marketsPage: marketsPageValue }) });
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="mt-4 mb-4">
            Filter by Market Status: {marketStatus ?? "All"}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Market Status</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() =>
                navigate({
                  search: (prev) => {
                    delete prev.marketStatus;
                    return { ...prev, marketsPage: 0 };
                  },
                })
              }
            >
              All
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    marketStatus: "active",
                    marketsPage: 0,
                  }),
                })
              }
              className={marketStatus === "active" ? "bg-accent" : ""}
            >
              Active
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    marketStatus: "resolved",
                    marketsPage: 0,
                  }),
                })
              }
              className={marketStatus === "resolved" ? "bg-accent" : ""}
            >
              Resolved
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="gap-4 grid">
        {markets.map((market) => (
          <MarketRow key={market.id} market={market} />
        ))}
      </div>

      <PaginationControl
        onPageChange={onPageChange}
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </div>
  );
}

function MarketRow({ market }: { market: MarketWithoutOutcomes }) {
  return (
    <Card className="bg-card">
      <CardContent className="relative pt-5 pb-5">
        <div className="flex sm:flex-row flex-col sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="mb-2 font-medium text-base leading-tight">{market.title}</h3>

            {market.description && (
              <p className="mb-3 text-muted-foreground text-sm line-clamp-2">
                {market.description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-xs">
              <div>
                Created:{" "}
                <span className="font-medium text-foreground">
                  {new Date(market.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                Participants:{" "}
                <span className="font-medium text-foreground">{market.numParticipants}</span>
              </div>
              <div>
                Total Bets:{" "}
                <span className="font-medium text-foreground">${market.totalBetSize}</span>
              </div>
            </div>
          </div>

          <Badge
            variant={market.status === "active" ? "default" : "secondary"}
            className={`${market.status === "resolved" ? "bg-emerald-600" : ""} rounded-md! w-16! h-6! absolute -bottom-6 right-0 md:relative!`}
          >
            {market.status === "active" ? "Active" : "Resolved"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
