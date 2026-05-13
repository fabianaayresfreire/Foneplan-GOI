import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type Produto = {
  id: string;
  titulo: string;
  sku?: string | null;
  marca?: string | null;
  modelo?: string | null;
  unidade?: string | null;
  msrp?: number | null;
};

export function ProdutoCombobox({
  value,
  selectedLabel,
  placeholder,
  onSelect,
}: {
  value: string | null;
  selectedLabel?: string | null;
  placeholder?: string;
  onSelect: (produto: Produto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // sanitize for ilike: PostgREST treats commas as separators in .or()
  const safe = useMemo(() => query.trim().replace(/[,()]/g, " "), [query]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from("produtos")
        .select("id,titulo,sku,marca,modelo,unidade,msrp")
        .eq("status", true)
        .order("titulo")
        .limit(50);
      if (safe) {
        const like = `%${safe}%`;
        q = q.or(
          `titulo.ilike.${like},sku.ilike.${like},marca.ilike.${like},modelo.ilike.${like}`
        );
      }
      const { data } = await q;
      setResults(data || []);
      setLoading(false);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [safe, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal h-9"
        >
          <span className="truncate text-left">
            {selectedLabel || (value ? "Produto selecionado" : placeholder || "Selecionar produto...")}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por título, SKU, marca, modelo..."
              className="pl-8 h-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
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
                "w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2",
                p.id === value && "bg-accent"
              )}
              onClick={() => {
                onSelect(p);
                setOpen(false);
                setQuery("");
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  p.id === value ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.titulo}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[p.sku, p.marca, p.modelo].filter(Boolean).join(" · ")}
                </div>
              </div>
              {p.msrp ? (
                <div className="text-xs text-muted-foreground shrink-0">
                  R$ {Number(p.msrp).toFixed(2)}
                </div>
              ) : null}
            </button>
          ))}
          {!query && results.length >= 50 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
              Mostrando 50. Digite para refinar.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
