import { useEffect } from "react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import OrcamentoEditor, { sessaoVersaoMap } from "@/components/OrcamentoEditor";

export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  component: OrcamentoIdPage,
});

function OrcamentoIdPage() {
  const { id } = Route.useParams();
  const { pathname } = useLocation();

  // Limpa a versão cacheada apenas ao sair do orçamento por completo.
  // Não roda ao navegar para /pdf e voltar (OrcamentoIdPage permanece montado nesses casos).
  useEffect(() => {
    return () => { sessaoVersaoMap.delete(id); };
  }, [id]);

  // Sub-rotas como /pdf são renderizadas pelo Outlet
  if (pathname.includes("/pdf")) return <Outlet />;

  return <OrcamentoEditor orcamentoId={id} />;
}
