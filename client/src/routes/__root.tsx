import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { AuthProvider, getMeServerFn } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url";
import { api } from "@/lib/api";

function NotFoundComponent() {
  return (
    <div className="flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="text-center">
        <h1 className="mb-4 font-bold text-gray-900 text-6xl">404</h1>
        <p className="mb-2 font-semibold text-gray-700 text-2xl">Page Not Found</p>
        <p className="mb-8 text-gray-600">The page you are looking for does not exist.</p>
        <a
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  loader: async () => {
    const data = await getMeServerFn()
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
        title: "TanStack Start Starter",
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
  const isLoading = useRouterState({ select: (s) => s.isLoading && s.status === "pending" && s.resolvedLocation !== null });

  return (
    <AuthProvider initialUser={user}>
      {isLoading && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50">
          <div className="flex flex-col items-center gap-3 bg-white shadow-xl px-10 py-8 rounded-xl">
            <div className="border-4 border-gray-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin" />
            <p className="font-medium text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      )}
      <Outlet />
      <Toaster />
      <TanStackDevtools
        config={{ position: "bottom-right" }}
        plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
      />
    </AuthProvider>
  );
}