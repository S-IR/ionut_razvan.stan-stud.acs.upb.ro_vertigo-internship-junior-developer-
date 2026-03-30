"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Copy, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

interface Endpoint {
    method: "GET" | "POST" | "DELETE";
    path: string;
    description: string;
    auth: "none" | "api-key" | "admin";
    requestBody?: {
        name: string;
        type: string;
        required: boolean;
        description: string;
    }[];
    queryParams?: {
        name: string;
        type: string;
        required: boolean;
        description: string;
    }[];
    pathParams?: {
        name: string;
        type: string;
        description: string;
    }[];
    response: string;
    example?: {
        request?: string;
        response: string;
    };
}

const endpoints: Record<string, Endpoint[]> = {
    markets: [
        {
            method: "GET",
            path: "/api/markets/public",
            description: "List all markets with pagination and filtering",
            auth: "none",
            queryParams: [
                { name: "status", type: "string", required: false, description: '"active" or "resolved". Defaults to "active"' },
                { name: "page", type: "number", required: false, description: "Page number (0-indexed). Defaults to 0" },
                { name: "sort", type: "string[]", required: false, description: "Sort options: DateAscending, DateDescending, TotalBetSizeAscending, TotalBetSizeDescending, NumOfParticipantsAscending, NumOfParticipantsDescending. \n Cannot ask to sort ascendingy and descendingly for the same field. \n If you have multiple sort requests the result will always be sorted in the following order: Date, Total Bet Size, Number of Participants" },
            ],
            response: '{ totalPages: number, markets: Market[] }',
            example: {
                response: `{
  "totalPages": 5,
  "markets": [
    {
      "id": 1,
      "title": "Will BTC reach 100k?",
      "status": "active",
      "creator": "satoshi",
      "totalMarketBets": 5000,
      "outcomes": [
        { "id": 1, "title": "Yes", "totalBets": 3000, "odds": 1.67 },
        { "id": 2, "title": "No", "totalBets": 2000, "odds": 2.5 }
      ]
    }
  ]
}`,
            },
        },
        {
            method: "GET",
            path: "/api/markets/public/:id",
            description: "Get detailed information about a specific market",
            auth: "none",
            pathParams: [
                { name: "id", type: "number", description: "The market ID" },
            ],
            response: "Market",
            example: {
                response: `{
  "id": 1,
  "title": "Will BTC reach 100k?",
  "description": "Will Bitcoin reach $100,000 by end of 2025?",
  "status": "active",
  "creator": "satoshi",
  "totalMarketBets": 5000,
  "outcomes": [
    { "id": 1, "title": "Yes", "totalBets": 3000, "odds": 1.67 },
    { "id": 2, "title": "No", "totalBets": 2000, "odds": 2.5 }
  ]
}`,
            },
        },
        {
            method: "POST",
            path: "/api/markets/public",
            description: "Create a new prediction market",
            auth: "api-key",
            requestBody: [
                { name: "title", type: "string", required: true, description: "The market title/question" },
                { name: "description", type: "string", required: false, description: "Optional detailed description" },
                { name: "outcomes", type: "string[]", required: true, description: "Array of outcome titles (minimum 2)" },
            ],
            response: "{ id, title, description, status, outcomes }",
            example: {
                request: `{
  "title": "Will it rain tomorrow?",
  "description": "In San Francisco",
  "outcomes": ["Yes", "No"]
}`,
                response: `{
  "id": 42,
  "title": "Will it rain tomorrow?",
  "description": "In San Francisco",
  "status": "active",
  "outcomes": [
    { "id": 101, "marketId": 42, "title": "Yes", "position": 0 },
    { "id": 102, "marketId": 42, "title": "No", "position": 1 }
  ]
}`,
            },
        },
    ],
    bets: [
        {
            method: "POST",
            path: "/api/markets/public/:id/bets",
            description: "Place a bet on a market outcome",
            auth: "api-key",
            pathParams: [
                { name: "id", type: "number", description: "The market ID" },
            ],
            requestBody: [
                { name: "outcomeId", type: "number", required: true, description: "The outcome ID to bet on" },
                { name: "amount", type: "number", required: true, description: "Bet amount (must be positive, deducted from balance)" },
            ],
            response: "{ id, userId, marketId, outcomeId, amount, winnings }",
            example: {
                request: `{
  "outcomeId": 1,
  "amount": 100
}`,
                response: `{
  "id": 500,
  "userId": 10,
  "marketId": 1,
  "outcomeId": 1,
  "amount": 100,
  "winnings": null
}`,
            },
        },
    ],
    outcomes: [
        {
            method: "GET",
            path: "/api/markets/public/:id",
            description: "View outcomes for a market (included in market details)",
            auth: "none",
            pathParams: [
                { name: "id", type: "number", description: "The market ID" },
            ],
            response: "Market with outcomes array",
            example: {
                response: `{
  "id": 1,
  "title": "Will BTC reach 100k?",
  "outcomes": [
    { "id": 1, "title": "Yes", "totalBets": 3000, "odds": 1.67 },
    { "id": 2, "title": "No", "totalBets": 2000, "odds": 2.5 }
  ]
}`,
            },
        },
    ],
};

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="group relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{code}</code>
            </pre>
            <Button
                variant="ghost"
                size="icon"
                className="top-2 right-2 absolute opacity-0 group-hover:opacity-100 w-8 h-8 transition-opacity"
                onClick={handleCopy}
            >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
        </div>
    );
}

function MethodBadge({ method }: { method: "GET" | "POST" | "DELETE" }) {
    const colors = {
        GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-mono font-semibold border ${colors[method]}`}>
            {method}
        </span>
    );
}

function AuthBadge({ auth }: { auth: "none" | "api-key" | "admin" }) {
    if (auth === "none") {
        return <Badge variant="secondary">Public</Badge>;
    }
    if (auth === "admin") {
        return <Badge variant="destructive">Admin Only</Badge>;
    }
    return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            <Key className="mr-1 w-3 h-3" />
            API Key Required
        </Badge>
    );
}

function ParamDescription({ description }: { description: string }) {
    const lines = description.split("\n").map((line) => line.trim()).filter(Boolean);
    return (
        <span className="mt-1 text-muted-foreground basis-full">
            {lines.map((line, i) => (
                <span key={i} className={i === 0 ? "" : "block mt-0.5"}>
                    {i === 0 ? `- ${line}` : line}
                </span>
            ))}
        </span>
    );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
    return (
        <Card className="border-border/50">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                    <MethodBadge method={endpoint.method} />
                    <code className="bg-muted px-2 py-1 rounded font-mono text-sm">{endpoint.path}</code>
                    <AuthBadge auth={endpoint.auth} />
                </div>
                <CardDescription className="mt-2">{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {endpoint.pathParams && endpoint.pathParams.length > 0 && (
                    <div>
                        <h4 className="mb-2 font-semibold text-sm">Path Parameters</h4>
                        <div className="space-y-2">
                            {endpoint.pathParams.map((param) => (
                                <div key={param.name} className="flex items-start gap-2 text-sm">
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{param.name}</code>
                                    <span className="text-muted-foreground text-xs">({param.type})</span>
                                    <ParamDescription description={param.description} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                    <div>
                        <h4 className="mb-2 font-semibold text-sm">Query Parameters</h4>
                        <div className="space-y-2">
                            {endpoint.queryParams.map((param) => (
                                <div key={param.name} className="flex flex-wrap items-start gap-2 text-sm">
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{param.name}</code>
                                    <span className="text-muted-foreground text-xs">({param.type})</span>
                                    {param.required && <Badge variant="destructive" className="py-0 text-xs">required</Badge>}
                                    <ParamDescription description={param.description} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                    <div>
                        <h4 className="mb-2 font-semibold text-sm">Request Body</h4>
                        <div className="space-y-2">
                            {endpoint.requestBody.map((param) => (
                                <div key={param.name} className="flex flex-wrap items-start gap-2 text-sm">
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{param.name}</code>
                                    <span className="text-muted-foreground text-xs">({param.type})</span>
                                    {param.required && <Badge variant="destructive" className="py-0 text-xs">required</Badge>}
                                    <ParamDescription description={param.description} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {endpoint.example && (
                    <div className="space-y-3">
                        {endpoint.example.request && (
                            <div>
                                <h4 className="mb-2 font-semibold text-sm">Example Request</h4>
                                <CodeBlock code={endpoint.example.request} />
                            </div>
                        )}
                        <div>
                            <h4 className="mb-2 font-semibold text-sm">Example Response</h4>
                            <CodeBlock code={endpoint.example.response} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function ApiDocumentationPage() {
    const { user } = useAuth()
    return (
        <div className="bg-background min-h-screen text-foreground dark">
            <div className="mx-auto px-4 py-8 max-w-4xl container">
                <div className="mb-8">
                    <h1 className="mb-2 font-bold text-3xl">API Documentation</h1>
                    <p className="text-muted-foreground">
                        Use these endpoints to interact with prediction markets programmatically.
                    </p>
                </div>

                <Card className="bg-amber-500/5 mb-8 border-amber-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-400">
                            <Key className="w-5 h-5" />
                            Authentication
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            Protected endpoints require an API key. Generate one from your{" "}
                            {user ?
                                <Link to="/users/$userID" params={{ userID: user.id }} href="/" className="text-primary underline underline-offset-2">
                                    {"profile page"}
                                </Link>
                                :
                                "profile page"
                            }

                            {" by enabling Developer Mode"}.
                        </p>
                        <div>
                            <h4 className="mb-2 font-semibold text-sm">Include your API key in the request header:</h4>
                            <CodeBlock code={`Authorization: Bearer your-api-key-here`} language="bash" />
                        </div>
                        <div className="space-y-1 text-muted-foreground text-sm">
                            <p>API keys can be revoked at any time from your profile</p>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="markets" className="space-y-6">
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="markets">Markets</TabsTrigger>
                        <TabsTrigger value="bets">Bets</TabsTrigger>
                        <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="markets" className="space-y-4">
                        <div className="mb-4">
                            <h2 className="font-mali font-semibold text-xl">Markets</h2>
                            <p className="text-muted-foreground text-sm">Create and list prediction markets</p>
                        </div>
                        {endpoints.markets.map((endpoint, index) => (
                            <EndpointCard key={index} endpoint={endpoint} />
                        ))}
                    </TabsContent>

                    <TabsContent value="bets" className="space-y-4">
                        <div className="mb-4">
                            <h2 className="font-mali font-semibold text-xl">Bets</h2>
                            <p className="text-muted-foreground text-sm">Place bets on market outcomes</p>
                        </div>
                        {endpoints.bets.map((endpoint, index) => (
                            <EndpointCard key={index} endpoint={endpoint} />
                        ))}
                    </TabsContent>

                    <TabsContent value="outcomes" className="space-y-4">
                        <div className="mb-4">
                            <h2 className="font-mali font-semibold text-xl">Outcomes</h2>
                            <p className="text-muted-foreground text-sm">View market outcomes and odds</p>
                        </div>
                        {endpoints.outcomes.map((endpoint, index) => (
                            <EndpointCard key={index} endpoint={endpoint} />
                        ))}
                    </TabsContent>
                </Tabs>

                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Error Responses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            All errors return a JSON object with an <code className="bg-muted px-1 rounded">errors</code> array:
                        </p>
                        <CodeBlock
                            code={`{
  "errors": ["Error message here"]
}`}
                        />
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">400</Badge>
                                <span className="text-muted-foreground">Bad Request - Invalid input or validation error</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">401</Badge>
                                <span className="text-muted-foreground">Unauthorized - Missing or invalid API key</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">404</Badge>
                                <span className="text-muted-foreground">Not Found - Resource does not exist</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">409</Badge>
                                <span className="text-muted-foreground">Conflict - Resource already exists</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
export const Route = createFileRoute('/api-documentation')({
    component: ApiDocumentationPage,
})