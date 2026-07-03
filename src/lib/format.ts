/** Formata número de orçamento — exibe o valor do banco diretamente (50000, 50001…). */
export const fmtOrcNum = (n: number | null | undefined): string =>
  n != null ? String(n) : "—";

/** Formata número de orçamento com sufixo de versão opcional (ex.: 50001A). */
export const fmtOrcNumV = (n: number | null | undefined, versao?: string | null): string =>
  n != null ? String(n) + (versao || "") : "—";

export const brl = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const STATUS_LABELS: Record<string, string> = {
  em_elaboracao:   "Em elaboração",
  enviado_cliente: "Enviado ao cliente",
  aprovado:        "Aprovado",
  cancelado:       "Cancelado",
};

export const TIPO_ITEM_LABELS: Record<string, string> = {
  venda_normal: "Venda normal",
  mao_de_obra: "Mão de obra",
  cabos: "Cabos",
  cliente: "Cliente",
  cortesia: "Cortesia",
  fase_anterior: "Fase anterior",
  proxima_fase: "Próxima fase",
  opcional: "Opcional",
  nao_incluso: "Não incluso",
};
