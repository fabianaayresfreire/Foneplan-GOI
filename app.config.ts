// Configuração nativa do TanStack Start (via Vinxi/Nitro).
// Define o preset de deploy como "vercel" — o Nitro gera automaticamente
// o output em .vercel/output/ no formato Vercel Build Output API v3.
//
// NÃO use @cloudflare/vite-plugin aqui: esse plugin serializa o bundle
// para o formato de Cloudflare Workers, incompatível com Vercel.

import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    preset: "vercel",
  },
  vite: {
    plugins: [
      tailwindcss(),
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
});
