export const brl = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_elaboracao: "Em elaboração",
  em_revisao: "Em revisão",
  enviado_cliente: "Enviado ao cliente",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
  proxima_fase: "Próxima fase",
  finalizado: "Finalizado",
};

export const TIPO_ITEM_LABELS: Record<string, string> = {
  venda_normal: "Venda normal",
  cliente: "Cliente",
  cortesia: "Cortesia",
  fase_anterior: "Fase anterior",
  proxima_fase: "Próxima fase",
  opcional: "Opcional",
  nao_incluso: "Não incluso",
};
