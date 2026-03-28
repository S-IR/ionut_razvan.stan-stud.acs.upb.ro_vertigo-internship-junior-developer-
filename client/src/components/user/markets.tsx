
import { MarketWithoutOutcomes } from '@/lib/api'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from '@/components/ui/badge'
import { Route } from '@/routes/users/$userID'
import { PaginationControl } from './pagination'

export function MarketsList({
    markets,
    currentPage,
    totalPages,
}: {
    markets: MarketWithoutOutcomes[];   // Use your interface
    currentPage: number
    totalPages: number
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
        navigate({ search: (prev) => ({ ...prev, marketsPage: marketsPageValue }) })
    }

    return (
        <div>
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
            <CardContent className="pt-5 pb-5">
                <div className="flex sm:flex-row flex-col sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="mb-2 font-medium text-base leading-tight">
                            {market.title}
                        </h3>

                        {market.description && (
                            <p className="mb-3 text-muted-foreground text-sm line-clamp-2">
                                {market.description}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-xs">
                            <div>
                                Created: <span className="font-medium text-foreground">
                                    {new Date(market.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div>
                                Participants: <span className="font-medium text-foreground">
                                    {market.numParticipants}
                                </span>
                            </div>
                            <div>
                                Total Bets: <span className="font-medium text-foreground">
                                    ${market.totalBetSize}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-shrink-0 mt-1 sm:mt-0">
                        <Badge
                            variant={market.status === "active" ? "default" : "secondary"}
                            className={market.status === "resolved" ? "bg-emerald-600" : ""}
                        >
                            {market.status === "active" ? "Active" : "Resolved"}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}