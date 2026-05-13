import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GOI · Foneplan — Gerador de Orçamentos Inteligentes" },
      { name: "description", content: "Sistema interno Foneplan para criação de orçamentos técnico-comerciais." },
      { property: "og:title", content: "GOI · Foneplan — Gerador de Orçamentos Inteligentes" },
      { name: "twitter:title", content: "GOI · Foneplan — Gerador de Orçamentos Inteligentes" },
      { property: "og:description", content: "Sistema interno Foneplan para criação de orçamentos técnico-comerciais." },
      { name: "twitter:description", content: "Sistema interno Foneplan para criação de orçamentos técnico-comerciais." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a86dabf3-7106-4d8d-9a24-52aff7abc6ea/id-preview-d01e0e9d--4644cc0e-7760-4836-b30e-8f04abae6e4e.lovable.app-1778535719195.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a86dabf3-7106-4d8d-9a24-52aff7abc6ea/id-preview-d01e0e9d--4644cc0e-7760-4836-b30e-8f04abae6e4e.lovable.app-1778535719195.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
