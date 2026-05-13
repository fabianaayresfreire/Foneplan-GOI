import { createFileRoute } from "@tanstack/react-router";
import OrcamentoEditor from "@/components/OrcamentoEditor";

export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  component: () => {
    const { id } = Route.useParams();
    return <OrcamentoEditor orcamentoId={id} />;
  },
});
