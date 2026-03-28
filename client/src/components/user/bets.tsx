import { BetStatus, BetWithDetails } from '@/lib/api'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { assert } from '@/lib/utils'
import { Route } from '@/routes/users/$userID'
import { PaginationControl } from './pagination'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button'

export function BetsList({
    bets,
    betStatus,
    currentPage,
    totalPages,
}: {
    bets: BetWithDetails[];
    betStatus: BetStatus | undefined
    currentPage: number
    totalPages: number

}) {
    assert(totalPages >= 0 && !Number.isNaN(totalPages))
    const navigate = Route.useNavigate();




    function onPageChange(betPageValue: number) {
        navigate({ search: (prev) => ({ ...prev, betPage: betPageValue }) })
    }
    return (
        <div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        Filter by Status: {betStatus ?? "All"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Bet Status</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigate({ search: (prev) => { delete prev.betStatus; return { ...prev, betPage: 0 } } })}
                        >
                            All
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => navigate({ search: (prev) => ({ ...prev, betStatus: "ongoing", betPage: 0 }) })}
                            className={betStatus === "ongoing" ? "bg-accent" : ""}
                        >
                            Ongoing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => navigate({ search: (prev) => ({ ...prev, betStatus: "won", betPage: 0 }) })}
                            className={betStatus === "won" ? "bg-accent" : ""}
                        >
                            Won
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => navigate({ search: (prev) => ({ ...prev, betStatus: "lost", betPage: 0 }) })}
                            className={betStatus === "lost" ? "bg-accent" : ""}
                        >
                            Lost
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {bets.length === 0 ?
                <Card>
                    <CardContent className="flex justify-center items-center py-12">
                        <p className="text-muted-foreground">No bets to display</p>
                    </CardContent>
                </Card>
                :
                <>
                    <div className="gap-3 grid">
                        {bets.map((bet) => (
                            <BetCard key={bet.id} bet={bet} />
                        ))}
                    </div>
                    <PaginationControl onPageChange={onPageChange} currentPage={currentPage} totalPages={totalPages} />
                </>


            }

        </div>
    );
}
export function BetCard({ bet }: { bet: BetWithDetails }) {
    const isClosed = bet.status !== "ongoing"

    const currentOdds = bet.outcome.odds !== undefined && bet.outcome.odds !== 0
        ? bet.outcome.odds.toFixed(2)
        : "N/A";

    return (
        <Card className="bg-card">

            <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{bet.market.title}</h3>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Your pick: <span className="font-medium text-foreground">{bet.outcome.title}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-muted-foreground text-xs">Amount: ${bet.amount}</span>
                            {!isClosed && (
                                <span className="text-muted-foreground text-xs">Odds: {currentOdds}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {bet.status === "ongoing" &&
                            <Badge variant="default">Active</Badge>
                        }
                        {bet.status === "lost" &&
                            <Badge variant={"destructive"}>
                                Lost
                            </Badge>

                        }

                        {bet.status === "won" &&
                            <Badge variant={"default"} className={"bg-emerald-600"}>
                                Won
                            </Badge>
                        }

                    </div>
                </div>
            </CardContent>
        </Card>
    );
}