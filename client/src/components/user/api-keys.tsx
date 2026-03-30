
import { api, APIError, APIKey, } from '@/lib/api'
import { Link, redirect } from '@tanstack/react-router'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { assert, getUserAPIKeysServerSide } from '@/lib/utils'
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
import { Route } from '@/routes/users/$userID'
import { PaginationControl } from './pagination'


export function ApiKeysTab({ apiKeys, totalPages, refetchKeys, currentPage }: { apiKeys: APIKey[], currentPage: number, totalPages: number, refetchKeys: () => void }) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [keyName, setKeyName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
    const [newKeyValue, setNewKeyValue] = useState("");
    const [copied, setCopied] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [expiresAt, setExpiresAt] = useState("");

    const navigate = Route.useNavigate();

    const [error, setError] = useState("")

    const handleCreateKey = async () => {
        if (keyName.trim().length === 0) {
            setError("please set an api key name")
            return
        }

        if (new Date(expiresAt) < new Date()) {
            setError("please set a date that is later than the current date")
            return
        }
        setError("")
        try {
            const data = await api.createAPIKey(keyName.trim(), new Date(expiresAt).toISOString())
            assert(data && data.key)
            setNewKeyValue(data.key);
            setCreateDialogOpen(false);
            setKeyName("");
            setExpiresAt("");
            refetchKeys()
            setNewKeyModalOpen(true);
        } catch (error) {
            console.error("Failed to create API key:", error);

            if (error instanceof APIError) {
                throw redirect({ to: "/server-error" })
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteKey = async (id: number) => {
        setDeletingId(id);
        try {
            await api.deleteAPIKey(id).then(() => refetchKeys())
        } catch (error) {


            if (error instanceof APIError) {
                throw redirect({ to: "/server-error" })
            }

            console.error("Failed to delete API key:", error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleCopyKey = async () => {
        await navigator.clipboard.writeText(newKeyValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    function onPageChange(apiPageValue: number) {
        navigate({ search: (prev) => ({ ...prev, apiPage: apiPageValue }) })
    }
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className='flex flex-col'>
                    <h2 className="flex items-center gap-2 font-semibold text-lg">
                        <Key className="w-5 h-5" />
                        API Keys
                    </h2>


                    <Link className='my-4 hover:text-cyan-200 text-xs underline transition-all duration-300' to='/api-documentation'>
                        API documentation
                    </Link>

                </div>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="mr-1 w-4 h-4" />
                            Create Key
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create API Key</DialogTitle>
                            <DialogDescription>Give your API key a name to help you identify it later.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label htmlFor="key-name" className="font-medium text-sm">Name</label>
                                <Input
                                    id="key-name"
                                    placeholder="Key name (e.g., Production, Development)"
                                    value={keyName}
                                    minLength={1}
                                    onChange={(e) => setKeyName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="expires-at" className="font-medium text-sm">Expiration Date (optional)</label>
                                <Input
                                    id="expires-at"
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                />
                            </div>

                        </div>
                        {error && (
                            <div className="bg-destructive/10 px-4 py-3 border border-destructive/20 rounded-md text-destructive-foreground text-sm">
                                {error}
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateKey} disabled={isCreating || !keyName.trim()}>
                                {isCreating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>


            <Dialog open={newKeyModalOpen} onOpenChange={setNewKeyModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Save Your API Key
                        </DialogTitle>
                        <DialogDescription className="font-medium text-amber-500">
                            Save this now, you won&apos;t see it again!
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="flex items-center gap-2">
                            <Input value={newKeyValue} readOnly className="font-mono text-sm" />
                            <Button variant="outline" size="icon" onClick={handleCopyKey}>
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setNewKeyModalOpen(false)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div>
                <div className="gap-3 grid">
                    {apiKeys.map((key) => (
                        <Card key={key.id} className="bg-card">
                            <CardContent className="pt-4">
                                <div className="flex justify-between items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Key className="w-4 h-4 text-muted-foreground" />
                                            <h3 className="font-medium text-sm">{key.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 text-muted-foreground text-xs">
                                            <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                                            <span>Expires at:  {key.expiresAt === null ? "Never" : new Date(key.expiresAt).toLocaleDateString()}</span>

                                            <span>Last used: {timeAgo(key.lastUsedAt)}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="hover:bg-destructive/10 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteKey(key.id)}
                                        disabled={deletingId === key.id}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <PaginationControl onPageChange={onPageChange} currentPage={currentPage} totalPages={totalPages} />

                {/* <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /> */}
            </div>
        </div>
    );
}
function timeAgo(date: Date | null): string {
    if (!date) return "Never";

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
}