
import { User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export interface User {
    id: number;
    balance: number;
    username: string;
    email: string;
    role: "admin" | "normal";
}


export function Navbar() {
    const { user } = useAuth()
    return (
        <header className="border-border border-b">
            <nav className="flex justify-between items-center mx-auto px-4 max-w-7xl h-14">
                <div className="flex items-center gap-6">
                    {/* Logo / Brand - placeholder for now */}
                    <Link to={"/"} className="text-stone-200 hover:text-white transition-all duration-300">
                        Home
                    </Link>

                    <Link to={"/leaderboards"} className="text-stone-200 hover:text-white transition-all duration-300">
                        Leaderboards
                    </Link>

                </div>

                <div className="flex items-center gap-2">
                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="group hover:bg-transparent! shadow-xl hover:shadow-none rounded-full">
                                    <Avatar className="size-8">
                                        <AvatarFallback className="group-hover:bg-stone-800 text-sm transition-all duration-300">
                                            {user.username.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col gap-1">
                                        <p className="font-medium text-sm">{user.username}</p>
                                        <p className="text-muted-foreground text-xs">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to={"/users/$userID"} params={{ userID: user.id }} className="cursor-pointer">
                                        <UserIcon className="mr-2 size-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                                    <Link className="flex" to={"/auth/logout"}>
                                        <LogOut className="mr-2 size-4" />
                                        Log out
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button asChild variant="default" size="sm">
                            <Link to={"/auth/login"}>Login</Link>
                        </Button>
                    )}
                </div>
            </nav>
        </header>
    );
}
