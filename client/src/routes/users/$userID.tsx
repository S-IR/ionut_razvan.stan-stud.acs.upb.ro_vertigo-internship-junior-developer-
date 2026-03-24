import { api, BetWithDetails } from '@/lib/api'
import { getMeServerFn, useAuth } from '@/lib/auth-context'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { getCookie } from '@tanstack/react-start/server'

export const Route = createFileRoute('/users/$userID')({
    loader: async ({ params }) => {
        const userIDNum = parseInt(params.userID)
        if (isNaN(userIDNum)) throw redirect({ to: "/auth/login" })
        const user = await getMeServerFn()
        if (!user || user.id !== userIDNum) throw redirect({ to: "/auth/login" })
        const token = getCookie("auth_token");
        if (!token) throw redirect({ to: "/auth/login" });

        const res = await api.getUserBets(userIDNum, {
            headers: {
                Cookie: `auth_token=${token}`,
            },
        })

        return res
    },

    component: RouteComponent,
})

const ITEMS_PER_USER_PAGE = 20
function RouteComponent() {
    const navigate = Route.useNavigate();
    const bets = Route.useLoaderData();
    const [activeBets] = useState(bets.filter((bet) => bet.market.status === "active"))
    const [resolvedBets] = useState(bets.filter((bet) => bet.market.status === "resolved"))

    const { user } = useAuth();
    if (!user) return navigate({ to: "/auth/login" })

    return (
        <div className="bg-background min-h-screen">
            <div className="mx-auto px-4 py-8 max-w-4xl">
                {/* User Header */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <div className="flex justify-center items-center bg-muted rounded-full w-12 h-12">
                                <span className="font-bold text-muted-foreground text-lg">
                                    {user.username.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h1 className="font-bold text-xl">{user.username}</h1>
                                <p className="font-normal text-muted-foreground text-sm">{user.email}</p>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-6 text-sm">
                            <div>
                                <span className="text-muted-foreground">Active Bets:</span>{" "}
                                <span className="font-medium">{activeBets.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Resolved Bets:</span>{" "}
                                <span className="font-medium">{resolvedBets.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Win Rate:</span>{" "}
                                <span className="font-medium">
                                    {resolvedBets.length > 0
                                        ? `${Math.round(
                                            (resolvedBets.filter((b) => b.market.resolvedOutcomeId === b.outcome.id).length /
                                                resolvedBets.length) *
                                            100
                                        )}%`
                                        : "N/A"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Bets Tabs */}
                <Tabs defaultValue="active">
                    <TabsList className="mb-4">
                        <TabsTrigger value="active">Active Bets ({activeBets.length})</TabsTrigger>
                        <TabsTrigger value="resolved">Resolved Bets ({resolvedBets.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="active">
                        <BetsList
                            bets={activeBets}
                            showResult={false}
                            emptyMessage="No active bets yet. Place your first bet!"
                        />
                    </TabsContent>

                    <TabsContent value="resolved">
                        <BetsList
                            bets={resolvedBets}
                            showResult={true}
                            emptyMessage="No resolved bets yet."
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
function BetsList({
    bets,
    showResult = false,
    emptyMessage,
}: {
    bets: BetWithDetails[];
    showResult?: boolean;
    emptyMessage: string;
}) {
    const [currentPage, setCurrentPage] = useState(0);
    const navigate = Route.useNavigate();

    const totalPages = Math.ceil(bets.length / ITEMS_PER_USER_PAGE);
    const paginatedBets = bets.slice(
        currentPage * ITEMS_PER_USER_PAGE,
        (currentPage + 1) * ITEMS_PER_USER_PAGE
    );

    if (bets.length === 0) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center py-12">
                    <p className="text-muted-foreground">{emptyMessage}</p>
                </CardContent>
            </Card>
        );
    }
    function onPageChange(pageAPIValue: number) {
        navigate({ search: (prev) => ({ ...prev, pageAPIValue }) })
    }
    return (
        <div>
            <div className="gap-3 grid">
                {paginatedBets.map((bet) => (
                    <BetCard key={bet.id} bet={bet} showResult={showResult} />
                ))}
            </div>
            <Pagination className="mt-4">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                            className={currentPage === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>

                    <PaginationItem>
                        <PaginationLink
                            isActive={currentPage === 0}
                            onClick={() => onPageChange(0)}
                            className="cursor-pointer"
                        >
                            1
                        </PaginationLink>
                    </PaginationItem>

                    {currentPage > 3 && (
                        <PaginationItem>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )}

                    {Array.from({ length: totalPages }, (_, i) => i)
                        .filter((i) => i !== 0 && i !== totalPages - 1 && Math.abs(i - currentPage) <= 2)
                        .map((i) => (
                            <PaginationItem key={i}>
                                <PaginationLink
                                    isActive={currentPage === i}
                                    onClick={() => onPageChange(i)}
                                    className="cursor-pointer"
                                >
                                    {i + 1}
                                </PaginationLink>
                            </PaginationItem>
                        ))}

                    {currentPage < totalPages - 4 && (
                        <PaginationItem>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )}

                    {totalPages > 1 && (
                        <PaginationItem>
                            <PaginationLink
                                isActive={currentPage === totalPages - 1}
                                onClick={() => onPageChange(totalPages - 1)}
                                className="cursor-pointer"
                            >
                                {totalPages}
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    <PaginationItem>
                        <PaginationNext
                            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                            className={currentPage === totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}

function BetCard({ bet, showResult = false }: { bet: BetWithDetails; showResult?: boolean }) {
    const isWinner = showResult && bet.market.resolvedOutcomeId === bet.outcome.id;
    const isLoser = showResult && bet.market.resolvedOutcomeId !== bet.outcome.id;

    // Calculate current odds (placeholder - replace with real-time data)
    const currentOdds = bet.outcome.totalBets
        ? ((bet.market.totalMarketBets ?? 0) / bet.outcome.totalBets).toFixed(2)
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
                            {!showResult && (
                                <span className="text-muted-foreground text-xs">Odds: {currentOdds}x</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {showResult ? (
                            <Badge variant={isWinner ? "default" : "destructive"} className={isWinner ? "bg-emerald-600" : ""}>
                                {isWinner ? "Won" : "Lost"}
                            </Badge>
                        ) : (
                            <Badge variant="secondary">Active</Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}