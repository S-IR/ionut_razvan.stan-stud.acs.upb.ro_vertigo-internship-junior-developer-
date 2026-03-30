import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod"
import { api, APIError, ESMarketEvent, MARKETS_SORT_BY_OPTION } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination, PaginationContent, PaginationEllipsis,
  PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"
import { useEffect, useRef, useState } from "react";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { page, sort, status } = Route.useSearch();
  const { markets, totalPages } = Route.useLoaderData();
  const marketsRef = useRef(markets);
  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);
  useEffect(() => {
    const es = api.sseMarkets();

    const handleMarketUpdated = async (e: MessageEvent) => {
      const { id: idFromWS } = JSON.parse(e.data);

      if (marketsRef.current.some(m => m.id === idFromWS)) {
        router.invalidate();
      }
    };

    const handleNewMarket = async () => {
      router.invalidate()
    };

    es.addEventListener(ESMarketEvent.MarketUpdated, handleMarketUpdated);
    es.addEventListener(ESMarketEvent.NewMarket, handleNewMarket);

    es.onerror = (e) => {
      console.error("SSE error", e);
    };

    return () => {
      es.close();
    };
  }, []);


  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen align-middle">
        <div className="text-center">
          <h1 className="mb-4 font-mali font-bold text-cyan-200 text-8xl">Folley</h1>

          <p className="mb-8 text-gray-200 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })} variant="cyan" size="xs">Login</Button>
            <Button onClick={() => navigate({ to: "/auth/register" })} variant="cyan" size="xs" className="bg-transparent text-emerald-200 hover:text-white">Sign Up</Button>
          </div>
          <img className="mx-auto" width={128} height={128} src="/logo.png" />
        </div>
      </div>
    );
  }

  function changeSortOptions(selectedSortOption: MARKETS_SORT_BY_OPTION, oppositeSortOption: MARKETS_SORT_BY_OPTION) {
    const exists = sort.includes(selectedSortOption);
    let newSort = sort.filter((el) => el !== oppositeSortOption);
    if (exists) newSort = newSort.filter((el) => el !== selectedSortOption);
    if (!exists) newSort = [...newSort, selectedSortOption];
    navigate({ search: (prev) => ({ ...prev, sort: newSort }) });
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto px-4 py-8 md:max-w-7xl!">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-mali font-bold text-cyan-200 text-xl md:text-4xl">Markets</h1>
            {/* <p className="mt-2 text-gray-600">Welcome back, {user?.username}!</p> */}
          </div>
          <div className="flex items-center gap-4">
            <Button variant={"secondary"} onClick={() => navigate({ to: "/markets/new" })}>Create Market</Button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex flex-col md:flex-row! items-center space-x-0 md:space-x-4! space-y-4 md:space-y-0!">

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mt-4 mb-4">
                  Market status: {status ?? "All"}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Market Status</DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() =>
                      navigate({
                        search: (prev) => {
                          delete prev.status;
                          return { ...prev, page: 0 };
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
                          status: "active",
                          page: 0,
                        }),
                      })
                    }

                    className={status === "active" ? "bg-accent" : ""}
                  >
                    Active
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          status: "resolved",
                          page: 0,
                        }),
                      })
                    }
                    className={status === "resolved" ? "bg-accent" : ""}
                  >
                    Resolved
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Sort By</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="flex w-auto! max-w-none!">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Created At Date</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.DateAsc, MARKETS_SORT_BY_OPTION.DateDesc)} className={sort.includes(MARKETS_SORT_BY_OPTION.DateAsc) ? "bg-accent" : ""}>Ascending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.DateDesc, MARKETS_SORT_BY_OPTION.DateAsc)} className={sort.includes(MARKETS_SORT_BY_OPTION.DateDesc) ? "bg-accent" : ""}>Descending</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Total Bet Size</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.TotalBetSizeAsc, MARKETS_SORT_BY_OPTION.TotalBetSizeDesc)} className={sort.includes(MARKETS_SORT_BY_OPTION.TotalBetSizeAsc) ? "bg-accent" : ""}>Ascending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.TotalBetSizeDesc, MARKETS_SORT_BY_OPTION.TotalBetSizeAsc)} className={sort.includes(MARKETS_SORT_BY_OPTION.TotalBetSizeDesc) ? "bg-accent" : ""}>Descending</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Number of Participants</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.NumOfParticipantsAsc, MARKETS_SORT_BY_OPTION.NumOfParticipantsDesc)} className={sort.includes(MARKETS_SORT_BY_OPTION.NumOfParticipantsAsc) ? "bg-accent" : ""}>Ascending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOptions(MARKETS_SORT_BY_OPTION.NumOfParticipantsDesc, MARKETS_SORT_BY_OPTION.NumOfParticipantsAsc)} className={sort.includes(MARKETS_SORT_BY_OPTION.NumOfParticipantsDesc) ? "bg-accent" : ""}>Descending</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>

        {markets.length === 0 ? (
          <Card>
            <CardContent className="flex justify-center items-center py-12">
              <p className="text-muted-foreground text-lg">No {status} markets found. {status === "active" && "Create one to get started!"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {markets.map((market) => <MarketCard key={market.id} market={market} />)}
          </div>
        )}

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


export const Route = createFileRoute("/")({
  component: DashboardPage,
  validateSearch: z.object({
    page: z.number().default(0),
    sort: z.array(z.nativeEnum(MARKETS_SORT_BY_OPTION)).default([]),
    status: z.optional(z.enum(["active", "resolved"])),
  }),
  loaderDeps: ({ search: { page, sort, status } }) => ({ page, sort, status }),
  loader: async ({ deps: { page, sort, status } }) => {
    try {
      return api.listMarkets(status, page, sort);
    } catch (error) {
      console.error(error)
      throw redirect({ to: "/server-error" })
    }
  },
});