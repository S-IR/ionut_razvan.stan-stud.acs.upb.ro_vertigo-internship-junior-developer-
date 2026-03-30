import { api, APIError, BetWithDetails, BET_STATUSES, APIKey, MarketStatuses, MarketWithoutOutcomes, ESMarketEvent, ESUserEvent } from '@/lib/api'
import { getMeServerFn, useAuth } from '@/lib/auth-context'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { z } from "zod"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button'
import { assert, getUserAPIKeysServerSide } from '@/lib/utils'
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react'
import { BetsList } from '@/components/user/bets'
import { MarketsList } from '@/components/user/markets'
import { ApiKeysTab } from '@/components/user/api-keys'

export const Route = createFileRoute('/users/$userID')({




    params: {
        parse: (params) => {
            const id = Number(params.userID);

            if (!Number.isInteger(id) || id <= 0) {
                throw redirect({ to: "/users/not-found" });
            }

            return { userID: id };
        },
    },
    validateSearch: z.object({
        betPage: z.number().default(0),
        marketsPage: z.number().default(0),
        marketStatus: z.optional(z.enum(MarketStatuses)),
        apiKeyPage: z.number().default(0),
        betStatus: z.optional(z.enum(BET_STATUSES)),
    }),
    loaderDeps: ({ search: { betPage, marketsPage, marketStatus, betStatus, apiKeyPage } }) =>
        ({ betPage, marketsPage, marketStatus, betStatus, apiKeyPage }),

    loader: async ({ params, deps }) => {

        try {
            const betsObj = await api.getUserBets(params.userID, deps.betPage, deps.betStatus)
            const marketsObj = await api.getUserMarkets(params.userID, deps.marketsPage, deps.marketStatus)
            const user = await api.getUser(params.userID)
            const isServerSide = typeof window === 'undefined'
            const me = isServerSide ? await getMeServerFn() : await api.me()
            const sameUser = me && user.id === me.id

            let apiKeysObj: {
                keys: APIKey[];
                totalPages: number;
            } = { keys: [], totalPages: 0 }
            if (sameUser) {
                apiKeysObj = isServerSide ? await getUserAPIKeysServerSide(deps.apiKeyPage) : await api.getUserApiKeys(deps.apiKeyPage)
            }
            const lastBetPage = Math.max(0, betsObj.totalPages - 1)
            const lastMarketsPage = Math.max(0, marketsObj.totalPages - 1)
            const lastApiKeyPage = Math.max(0, apiKeysObj.totalPages - 1)

            if (
                (betsObj.totalPages > 0 && deps.betPage > lastBetPage) ||
                (marketsObj.totalPages > 0 && deps.marketsPage > lastMarketsPage) ||
                (apiKeysObj.totalPages > 0 && deps.apiKeyPage > lastApiKeyPage)
            ) {
                throw redirect({
                    to: '/users/$userID',
                    params: { userID: params.userID },
                    search: (prev) => ({
                        ...prev,
                        betPage: betsObj.totalPages > 0 ? Math.min(deps.betPage, lastBetPage) : 0,
                        marketsPage: marketsObj.totalPages > 0 ? Math.min(deps.marketsPage, lastMarketsPage) : 0,
                        apiKeyPage: apiKeysObj.totalPages > 0 ? Math.min(deps.apiKeyPage, lastApiKeyPage) : 0,
                    }),
                })
            }

            return {
                user,
                bets: betsObj.bets,
                betsTotalPages: betsObj.totalPages,
                keys: apiKeysObj.keys,
                apiKeysTotalPages: apiKeysObj.totalPages,
                markets: marketsObj.markets,
                marketsTotalPages: marketsObj.totalPages,
            }
        } catch (error) {
            console.error(error)

            if (error instanceof APIError) {
                if (error.status === 401) {
                    throw redirect({ to: "/auth/login" })
                } if (error.status === 404) {
                    throw redirect({ to: "/users/not-found" })
                } else {
                    throw redirect({ to: "/server-error" })
                }
            } else {
                throw error
            }
        }
    },

    component: RouteComponent,
})

function RouteComponent() {
    const navigate = Route.useNavigate();
    const { user, bets, betsTotalPages, keys, apiKeysTotalPages, markets, marketsTotalPages } = Route.useLoaderData();

    if (betsTotalPages === 0) assert(bets.length === 0)
    if (marketsTotalPages === 0) assert(markets.length === 0)
    if (apiKeysTotalPages === 0) assert(keys.length === 0)
    const marketsRef = useRef(markets);
    useEffect(() => {
        marketsRef.current = markets;
    }, [markets]);


    const [activeBets] = useState(() => bets.filter((bet) => bet.market.status === "active"))
    const [resolvedBets] = useState(() => bets.filter((bet) => bet.market.status === "resolved"))

    const router = useRouter();

    const [developerMode, setDeveloperMode] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('developerMode')
        if (saved === 'true') {
            setDeveloperMode(true)
        }
    }, [])



    const { user: userThatsBrowsing } = useAuth();
    const sameUser = user.id === userThatsBrowsing?.id

    const { userID } = Route.useParams()
    const { betPage, betStatus, apiKeyPage, marketsPage, marketStatus } = Route.useSearch()

    if (!user) return navigate({ to: "/auth/login" })

    async function refetchKeys() {
        router.invalidate()
    }


    async function refetchMarkets() {
        router.invalidate()
    }
    useEffect(() => {
        const es = api.sseUsers()

        const handleUserUpdate = (e: MessageEvent) => {
            const { userID: idFromWS } = JSON.parse(e.data);

            if (idFromWS === userID) {
                router.invalidate();
            }
        };

        const handleNewBet = async (e: MessageEvent) => {
            const { userID: idFromWS } = JSON.parse(e.data);

            if (idFromWS !== userID) return;
            router.invalidate()
        };

        es.addEventListener(ESUserEvent.UserUpdated, handleUserUpdate);
        es.addEventListener(ESUserEvent.NewBet, handleNewBet);

        es.onerror = (e) => {
            console.error("SSE error", e);
        };

        return () => es.close();
    }, [userID]);

    useEffect(() => {
        const es = api.sseMarkets();

        const handleMarketUpdated = async (e: MessageEvent) => {
            const { id: idFromWS } = JSON.parse(e.data);

            if (marketsRef.current.some(m => m.id === idFromWS)) {
                router.invalidate();
            }
        };

        const handleNewMarket = async (e: MessageEvent) => {
            const { market } = JSON.parse(e.data);

            if (market?.creator?.id === userID) {
                refetchMarkets();
            }
        };

        es.addEventListener(ESMarketEvent.MarketUpdated, handleMarketUpdated);
        es.addEventListener(ESMarketEvent.NewMarket, handleNewMarket);

        es.onerror = (e) => {
            console.error("SSE error", e);
        };

        return () => es.close();
    }, [userID]);
    const toggleDeveloperMode = () => {
        const newMode = !developerMode
        localStorage.setItem('developerMode', String(newMode))
        setDeveloperMode(newMode)
    }
    return (
        <div className="bg-background pb-12 min-h-screen">
            <div className="mx-auto px-4 py-8 max-w-4xl">
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex justify-between items-start">
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
                            {sameUser &&

                                <div className="flex items-center gap-2">
                                    <label htmlFor="developer-mode" className="text-muted-foreground text-sm">
                                        Developer Mode
                                    </label>
                                    <Switch
                                        id="developer-mode"
                                        checked={developerMode}
                                        onCheckedChange={toggleDeveloperMode}
                                    />
                                </div>
                            }

                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-6 rounded-sm">
                            <div>
                                <span className="text-muted-foreground">Active Bets:</span>{" "}
                                <span className="font-medium">{activeBets.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Resolved Bets:</span>{" "}
                                <span className="font-medium">{resolvedBets.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Balance:</span>{" "}
                                <span className="font-medium">{user.balance.toFixed(2)}$</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Win Rate:</span>{" "}
                                <span className="font-medium">
                                    {resolvedBets.length > 0
                                        ? `${Math.round(
                                            (resolvedBets.filter((b) => b.market.resolvedOutcomeId === b.outcome.id).length /
                                                resolvedBets.length) * 100
                                        )}%`
                                        : "N/A"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>



                <Tabs defaultValue='bets' >
                    <TabsList className="bg-transparent! mb-4 border rounded-md!">
                        <TabsTrigger value="bets">Bets</TabsTrigger>
                        <TabsTrigger value="markets">Created Markets</TabsTrigger>
                        {sameUser && developerMode && <TabsTrigger value="api-keys">API Keys</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="bets">
                        <BetsList
                            betStatus={betStatus}
                            bets={bets}
                            currentPage={betPage}
                            totalPages={betsTotalPages}
                        />
                    </TabsContent>

                    <TabsContent value="markets">


                        <MarketsList
                            markets={markets}
                            currentPage={marketsPage}
                            totalPages={marketsTotalPages}
                            marketStatus={marketStatus}
                        />
                    </TabsContent>

                    {sameUser && developerMode && (
                        <TabsContent value="api-keys">
                            <ApiKeysTab
                                currentPage={apiKeyPage}
                                apiKeys={keys}
                                totalPages={apiKeysTotalPages}
                                refetchKeys={refetchKeys}
                            />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}