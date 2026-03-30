import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async (formData) => {
      const values = formData.value;
      try {
        setIsLoading(true);
        setError(null);
        const user = await api.login(values.email, values.password);
        login(user);
        navigate({ to: "/" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="flex justify-center items-center p-4 min-h-screen">
      <Card className="shadow-2xl hover:shadow-none w-full max-w-md transition-all duration-300">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Login</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                  {field.state.meta.errors && (
                    <p className="text-destructive text-xs">{field.state.meta.errors.join(", ")}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  {field.state.meta.errors && (
                    <p className="text-destructive text-xs">{field.state.meta.errors.join(", ")}</p>
                  )}
                </div>
              )}
            </form.Field>

            {error && (
              <div className="bg-destructive/10 px-4 py-3 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 text-muted-foreground text-sm text-center">
            Don't have an account?{" "}
            <a href="/auth/register" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});
