// Este arquivo é lido por ferramentas de dev (ex: TypeScript Language Server, ESLint).
// O build e o SSR são gerenciados por app.config.ts (CLI: vinxi build).
// NÃO adicione @cloudflare/vite-plugin aqui — o output seria incompatível com Vercel.

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
  ],
});
