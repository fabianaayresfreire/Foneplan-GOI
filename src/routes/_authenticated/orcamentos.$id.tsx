import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import OrcamentoEditor from "@/components/OrcamentoEditor";

export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  component: OrcamentoIdPage,
});

function OrcamentoIdPage() {
  const { id } = Route.useParams();
  const { pathname } = useLocation();

  // Sub-rotas como /pdf são renderizadas pelo Outlet
  if (pathname.includes("/pdf")) return <Outlet />;

  return <OrcamentoEditor orcamentoId={id} />;
}
