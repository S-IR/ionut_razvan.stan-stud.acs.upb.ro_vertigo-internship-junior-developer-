import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";
import { AuthProvider, getMeServerFn } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/navbar";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useGlobalLoading } from "@/lib/use-global-load";

function NotFoundComponent() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <p className="mb-2 font-mali font-semibold text-cyan-200 text-4xl lg:text-8xl">
          Page Not Found
        </p>
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2 mb-6">
            {/* <ArrowLeft className="w-4 h-4" /> */}
            Go to the main page
          </Button>
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  loader: async () => {
    const data = await getMeServerFn();
    return data;
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Folley",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const user = Route.useLoaderData();
  const routerLoading = useRouterState({
    select: (s) => s.isLoading && s.status === "pending" && s.resolvedLocation !== null,
  });

  const apiLoading = useGlobalLoading();
  const isLoading = routerLoading || apiLoading;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let t: any;

    if (isLoading) {
      t = setTimeout(() => setVisible(true), 200);
    } else {
      clearTimeout(t);
      setVisible(false);
    }

    return () => clearTimeout(t);
  }, [isLoading]);

  return (
    <AuthProvider initialUser={user}>
      {visible && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50">
          <div className="flex flex-col items-center gap-3 bg-white shadow-xl px-10 py-8 rounded-xl">
            <div className="border-4 border-gray-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin" />
            <p className="font-medium text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      )}
      <Navbar />
      <Outlet />
      <Toaster />
      <TanStackDevtools
        config={{ position: "bottom-right" }}
        plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
      />
    </AuthProvider>
  );
}
