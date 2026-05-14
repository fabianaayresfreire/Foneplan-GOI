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
      // Viewport: impede zoom duplo-toque no iOS, permite texto legível
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Foneplan GOI" },
      { name: "description", content: "Gerador de Orçamentos Inteligentes da Foneplan." },

      // ── PWA: cor da barra de status / browser chrome ──────────────────
      { name: "theme-color", content: "#F97316" },

      // ── PWA: Android / Chrome ──────────────────────────────────────────
      { name: "mobile-web-app-capable", content: "yes" },

      // ── PWA: iOS / Safari ──────────────────────────────────────────────
      { name: "apple-mobile-web-app-capable", content: "yes" },
      // "black-translucent" faz o conteúdo subir sob a status bar (island)
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "GOI" },

      // ── Open Graph / Twitter ───────────────────────────────────────────
      { property: "og:title", content: "Foneplan GOI" },
      { property: "og:description", content: "Gerador de Orçamentos Inteligentes da Foneplan." },
      { property: "og:image", content: "/icons/icon-512x512.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Foneplan GOI" },
      { name: "twitter:image", content: "/icons/icon-512x512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // ── PWA Manifest ────────────────────────────────────────────────────
      { rel: "manifest", href: "/manifest.json" },
      // ── Favicon ─────────────────────────────────────────────────────────
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      // ── Apple Touch Icon (ícone na tela inicial do iPhone) ───────────────
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      // Tamanhos explícitos para iPhone e iPad
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "167x167", href: "/apple-touch-icon.png" },
    ],
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
