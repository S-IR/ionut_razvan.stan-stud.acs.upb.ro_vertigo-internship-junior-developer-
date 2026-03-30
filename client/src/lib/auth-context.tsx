import { createContext, useContext, useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "./api";
import type { User } from "./api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);

  const login = (newUser: User) => setUser(newUser);

  const logout = async () => {
    await api.logout().catch((e) => console.error(e));
    setUser(null);
  };
  const refresh = async () => {
    const newUser = await api.me();
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading: false, login, logout, isAuthenticated: !!user, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export const getMeServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie("auth_token");
  if (!token) return null;

  const user = await api.me({
    headers: {
      Cookie: `auth_token=${token}`,
    },
  });

  return user;
});
