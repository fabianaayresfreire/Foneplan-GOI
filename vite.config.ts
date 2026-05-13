// Configuração oficial para TanStack Start + Vercel (documentação Vercel, mar/2026).
//
// Estrutura de plugins:
//   tanstackStart() → router file-based + SSR do TanStack Start
//   nitro()         → detecta VERCEL=1 automaticamente e gera .vercel/output/
//   viteReact()     → transform JSX/TSX
//   tailwindcss()   → Tailwind CSS v4
//   tsconfigPaths() → resolve alias @/* via tsconfig.json
//
// Build: `vite build`  |  Dev: `vite dev`
// NÃO use @cloudflare/vite-plugin aqui — gera output incompatível com Vercel.
// NÃO use app.config.ts + vinxi — abordagem antiga, substituída por esta.

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
});
