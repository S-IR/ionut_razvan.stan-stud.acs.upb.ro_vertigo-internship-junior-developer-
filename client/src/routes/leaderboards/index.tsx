import { api, APIError } from '@/lib/api';
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
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
import { PaginationControl } from '@/components/user/pagination';

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

            if (error instanceof APIError) {
                if (error.status === 401) {
                    throw redirect({ to: "/auth/login" })
                } else {
                    throw redirect({ to: "/server-error" })
                }
            } else {
                throw redirect({ to: "/server-error" })
            }


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
        <div className="bg-background pb-12 min-h-screen text-foreground">
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
                                    <Link

                                        to="/users/$userID"
                                        params={{ userID: user.id }}
                                        key={user.id}
                                        className={`flex items-center justify-between px-4 py-3 hover:bg-cyan-950 transition-all duration-300 ${getRankStyle(rank)}`}
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
                                    </Link>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
                {totalPages > 0 && <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={(val) => navigate({ search: (prev) => ({ ...prev, page: Math.max(0, val) }) })} />}

            </div>
        </div>
    );
}
