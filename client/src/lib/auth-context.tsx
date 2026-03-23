import { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "./api";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children, initialUser }: { children: React.ReactNode, initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);

  const login = (newUser: User) => setUser(newUser);

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: false, login, logout, isAuthenticated: !!user }}>
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

  const response = await fetch(`${process.env.VITE_API_URL || "http://localhost:4001"}/api/auth/me`, {
    headers: {
      Cookie: `auth_token=${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
});