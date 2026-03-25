import { api } from '@/lib/api';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from "zod"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";

export const Route = createFileRoute('/leaderboards/')({
    component: RouteComponent,

    validateSearch: z.object({
        page: z.number().default(0),
    }),
    loaderDeps: ({ search: { page } }) => ({ page }),
    loader: async ({ deps: { page } }) => {
        try {
            return await api.getLeaderboards(page);
        } catch (error) {
            console.error(error)
            throw redirect({ to: "/server-error" })
        }

    },
})
const ITEMS_PER_PAGE = 20
function RouteComponent() {





    const navigate = Route.useNavigate();
    const router = useRouter();
    const { page } = Route.useSearch();
    const { topUsers, totalPages } = Route.useLoaderData();


    function getRankStyle(rank: number) {
        if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30";
        if (rank === 2) return "bg-gray-400/10 border-gray-400/30";
        if (rank === 3) return "bg-amber-600/10 border-amber-600/30";
        return "bg-muted/50";
    }
    function getRankIcon(rank: number) {
        if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
        if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
        if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
        return null;
    }

    return (
        <div className="bg-background min-h-screen text-foreground dark">
            <div className="mx-auto px-4 py-8 max-w-3xl container">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            Leaderboard
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Top users ranked by total winnings
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {topUsers.map((user, index) => {
                                const rank = (page) * ITEMS_PER_PAGE + index + 1;
                                return (
                                    <div
                                        key={user.userId}
                                        className={`flex items-center justify-between px-4 py-3 ${getRankStyle(rank)}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex justify-center items-center w-8 h-8">
                                                {getRankIcon(rank) || (
                                                    <span className="font-medium text-muted-foreground text-sm">
                                                        {rank}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-medium">{user.username}</span>
                                        </div>
                                        <span className="font-mono text-sm">
                                            ${Number(user.totalWinnings || 0).toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {totalPages > 0 &&
                    <Pagination className="mt-4">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious onClick={() => navigate({ search: (prev) => ({ ...prev, page: Math.max(0, page - 1) }) })} />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink isActive={page === 0} onClick={() => navigate({ search: (prev) => ({ ...prev, page: 0 }) })}>1</PaginationLink>
                            </PaginationItem>
                            {page > 3 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                            {Array.from({ length: totalPages }, (_, i) => i)
                                .filter(i => i !== 0 && i !== totalPages - 1 && Math.abs(i - page) <= 2)
                                .map(i => (
                                    <PaginationItem key={i}>
                                        <PaginationLink isActive={page === i} onClick={() => navigate({ search: (prev) => ({ ...prev, page: i }) })}>{i + 1}</PaginationLink>
                                    </PaginationItem>
                                ))}
                            {page < totalPages - 4 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                            {totalPages > 1 && (
                                <PaginationItem>
                                    <PaginationLink isActive={page === totalPages - 1} onClick={() => navigate({ search: (prev) => ({ ...prev, page: totalPages - 1 }) })}>{totalPages}</PaginationLink>
                                </PaginationItem>
                            )}
                            <PaginationItem>
                                <PaginationNext onClick={() => navigate({ search: (prev) => ({ ...prev, page: Math.min(totalPages - 1, page + 1) }) })} />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                }
            </div>
        </div>
    );
}
