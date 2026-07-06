import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

export type Produto = {
  id: string;
  titulo: string;
  nome_fantasia?: string | null;
  sku?: string | null;
  marca?: string | null;
  modelo?: string | null;
  unidade?: string | null;
  msrp?: number | null;
  categoria?: string | null;
};

/** Retorna "SKU — Nome Fantasia" se disponível, senão o título. */
export const produtoLabel = (p: Pick<Produto, "titulo" | "nome_fantasia" | "sku">): string =>
  p.nome_fantasia
    ? `${p.sku ? p.sku + " — " : ""}${p.nome_fantasia}`
    : p.titulo;

const PAGE_SIZE = 50;

export function ProdutoCombobox({
  value,
  selectedLabel,
  placeholder,
  categoriaFilter,
  onSelect,
}: {
  value: string | null;
  selectedLabel?: string | null;
  placeholder?: string;
  /** Quando fornecido, filtra produtos cujo campo categoria bate (case-insensitive) com o nome do segmento selecionado. */
  categoriaFilter?: string | null;
  onSelect: (produto: Produto) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(0);
  const [total, setTotal]     = useState(0);

  // Cascata Marca → Modelo
  const [marcaFilter, setMarcaFilter]   = useState("");
  const [modeloFilter, setModeloFilter] = useState("");
  const [marcas, setMarcas]             = useState<string[]>([]);
  const [modelos, setModelos]           = useState<string[]>([]);

  const debounceRef = useRef<number | null>(null);

  const safe = useMemo(() => query.trim().replace(/[,()]/g, " "), [query]);

  // Reset page ao mudar qualquer filtro
  useEffect(() => { setPage(0); }, [safe, categoriaFilter, marcaFilter, modeloFilter]);

  // Limpa marca e modelo ao trocar segmento, e modelo ao trocar marca
  useEffect(() => { setMarcaFilter(""); setModeloFilter(""); }, [categoriaFilter]);
  useEffect(() => { setModeloFilter(""); }, [marcaFilter]);

  // Carrega marcas distintas filtradas pelo segmento ativo
  useEffect(() => {
    if (!open) return;
    let q = supabase
      .from("produtos")
      .select("marca")
      .eq("status", true)
      .not("marca", "is", null);
    if (categoriaFilter) q = (q as any).filter("categoria", "ilike", categoriaFilter);
    (q as any).then(({ data }: any) => {
      const distinct = [...new Set((data || []).map((r: any) => r.marca as string))].sort();
      setMarcas(distinct);
    });
  }, [open, categoriaFilter]);

  // Carrega modelos distintos filtrados pelo segmento e pela marca selecionada
  useEffect(() => {
    if (!open) return;
    let q = supabase
      .from("produtos")
      .select("modelo")
      .eq("status", true)
      .not("modelo", "is", null);
    if (categoriaFilter) q = (q as any).filter("categoria", "ilike", categoriaFilter);
    if (marcaFilter)     q = (q as any).eq("marca", marcaFilter);
    (q as any).then(({ data }: any) => {
      const distinct = [...new Set((data || []).map((r: any) => r.modelo as string))].sort();
      setModelos(distinct);
    });
  }, [open, categoriaFilter, marcaFilter]);

  // Fetch de produtos (debounced) — captura valores no início do efeito para evitar stale closures
  useEffect(() => {
    if (!open) return;
    const activeFilter = categoriaFilter;
    const activeMarca  = marcaFilter;
    const activeModelo = modeloFilter;
    const activeSafe   = safe;
    const activePage   = page;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);

      let q = supabase
        .from("produtos")
        .select("id,titulo,nome_fantasia,sku,marca,modelo,unidade,msrp,categoria", { count: "exact" })
        .eq("status", true)
        .order("titulo")
        .range(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE - 1);

      if (activeFilter) q = q.filter("categoria", "ilike", activeFilter);
      if (activeMarca)  q = q.eq("marca", activeMarca);
      if (activeModelo) q = q.eq("modelo", activeModelo);

      if (activeSafe) {
        const like = `%${activeSafe}%`;
        q = q.or(`titulo.ilike.${like},sku.ilike.${like},marca.ilike.${like},modelo.ilike.${like}`);
      }

      const { data, count } = await q;
      setResults(data || []);
      setTotal(count ?? 0);
      setLoading(false);
    }, 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [safe, open, page, categoriaFilter, marcaFilter, modeloFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev    = page > 0;
  const hasNext    = (page + 1) * PAGE_SIZE < total;

  const hasActiveFilters = !!(marcaFilter || modeloFilter);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          title={selectedLabel ?? undefined}
          className="w-full justify-between font-normal min-h-9 h-auto py-1.5"
        >
          <span className="whitespace-normal break-words text-left">
            {selectedLabel || (value ? "Produto selecionado" : placeholder || "Selecionar produto...")}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2 self-start mt-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(420px,calc(100vw-16px))] flex flex-col max-h-[70vh]" align="start">

        {/* ── Cabeçalho fixo ── */}
        <div className="p-2 border-b border-border shrink-0 bg-popover z-10 space-y-1.5">
          {categoriaFilter && (
            <div className="px-1 flex items-center gap-1 text-xs text-primary font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
              Filtrando: {categoriaFilter}
            </div>
          )}

          {/* Cascata Marca → Modelo */}
          <div className="flex gap-1.5">
            <select
              className="flex-1 h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={marcaFilter}
              onChange={(e) => setMarcaFilter(e.target.value)}
            >
              <option value="">Todas as marcas</option>
              {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="flex-1 h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              value={modeloFilter}
              onChange={(e) => setModeloFilter(e.target.value)}
              disabled={modelos.length === 0}
            >
              <option value="">Todos os modelos</option>
              {modelos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-1"
                onClick={() => { setMarcaFilter(""); setModeloFilter(""); }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Busca textual */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por título, SKU..."
              className="pl-8 h-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* ── Lista + Paginação ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!loading && results.length === 0 && (
            <div className="px-3 py-6 text-sm text-center text-muted-foreground">
              Nenhum produto encontrado
            </div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-start gap-2",
                p.id === value && "bg-accent"
              )}
              onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
            >
              <Check className={cn("h-4 w-4 mt-0.5 shrink-0", p.id === value ? "opacity-100" : "opacity-0")} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{produtoLabel(p)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.nome_fantasia
                    ? p.titulo
                    : [p.sku, p.marca, p.modelo].filter(Boolean).join(" · ")}
                </div>
              </div>
              {p.msrp ? (
                <div className="text-xs font-medium text-foreground shrink-0">
                  {brl(Number(p.msrp))}
                </div>
              ) : null}
            </button>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted sticky bottom-0">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <span className="text-xs font-semibold text-foreground/80">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Próximo
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
