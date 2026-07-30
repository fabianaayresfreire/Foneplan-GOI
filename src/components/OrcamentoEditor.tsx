import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Save, FileText, ArrowLeft, UserPlus, Loader2, Package, Wrench, Cable, ChevronsUpDown, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { brl, STATUS_LABELS, TIPO_ITEM_LABELS, fmtOrcNum, fmtOrcNumV } from "@/lib/format";
import { gerarPdfBlob, pdfFileName, abrirBlobPdf, type PdfItem, type PdfOrcamento } from "@/lib/pdf";
import { produtoLabel } from "@/components/ProdutoCombobox";
import { maskCpfCnpj, maskCep, maskPhone, fetchViaCep } from "@/lib/masks";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { ProdutoCombobox } from "@/components/ProdutoCombobox";
import { CurrencyInput } from "@/components/CurrencyInput";

type Item = {
  id?: string;
  segmento_id: string | null;
  ambiente_id: string | null;
  ambiente_nome?: string | null;
  kit_nome?: string | null;
  produto_id: string | null;
  produto_titulo: string;
  produto_sku?: string | null;
  nome_fantasia?: string | null;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  desconto_item: number;
  valor_total: number;
  tipo_item: string;
  observacao?: string | null;
  ordem_exibicao: number;
  _prevProdutoId?: string | null;
  _prevTitulo?: string;
  _prevSku?: string | null;
  _prevNomefantasia?: string | null;
};

// ── Kit definitions ────────────────────────────────────────────────────────────
type KitDef = {
  id: string;
  categoria: string;
  nome: string;
  composicao: string;
  itens: { descricao: string; quantidade: number }[];
};

const KITS: KitDef[] = [
  {
    id: "kit-51",
    categoria: "Áudio e Vídeo",
    nome: "Kit 5.1",
    composicao: "5 caixas de som + 1 Subwoofer + 1 Receptor",
    itens: [
      { descricao: "Caixa de som", quantidade: 5 },
      { descricao: "Subwoofer", quantidade: 1 },
      { descricao: "Receptor", quantidade: 1 },
    ],
  },
  {
    id: "kit-71",
    categoria: "Áudio e Vídeo",
    nome: "Kit 7.1",
    composicao: "7 caixas de som + 1 Subwoofer + 1 Receptor",
    itens: [
      { descricao: "Caixa de som", quantidade: 7 },
      { descricao: "Subwoofer", quantidade: 1 },
      { descricao: "Receptor", quantidade: 1 },
    ],
  },
  {
    id: "aut-32",
    categoria: "Automação",
    nome: "Automação 32 circuitos",
    composicao: "1 Fonte + 2 módulos de 12 canais relês + 1 módulo de 8 canais dimerizável",
    itens: [
      { descricao: "Fonte", quantidade: 1 },
      { descricao: "Módulo 12 canais relês", quantidade: 2 },
      { descricao: "Módulo 8 canais dimerizável", quantidade: 1 },
    ],
  },
  {
    id: "aut-60",
    categoria: "Automação",
    nome: "Automação 60 circuitos",
    composicao: "1 Fonte + 3 módulos de 12 canais relês + 3 módulos de 8 canais dimerizáveis",
    itens: [
      { descricao: "Fonte", quantidade: 1 },
      { descricao: "Módulo 12 canais relês", quantidade: 3 },
      { descricao: "Módulo 8 canais dimerizável", quantidade: 3 },
    ],
  },
  {
    id: "aut-44",
    categoria: "Automação",
    nome: "Automação 44 circuitos, 8 ares, 4 motores",
    composicao: "1 Fonte + 3 RL12 + 1 DIM8 + 1 IR-8 + 1 LX-4",
    itens: [
      { descricao: "Fonte", quantidade: 1 },
      { descricao: "Módulo 12 canais relês (RL12)", quantidade: 3 },
      { descricao: "Módulo 8 canais dimerizável (DIM8)", quantidade: 1 },
      { descricao: "Módulo ar condicionado (IR-8)", quantidade: 1 },
      { descricao: "Módulo de cortina (LX-4)", quantidade: 1 },
    ],
  },
];

/** Serializa os campos comercialmente relevantes de um array de itens para comparação de snapshot. */
const serializeItens = (arr: Item[]): string =>
  JSON.stringify(
    arr.map(it => ({
      pid:   it.produto_id   ?? null,
      titulo: it.produto_titulo,
      sku:   it.produto_sku  ?? null,
      nf:    it.nome_fantasia ?? null,
      qty:   it.quantidade,
      un:    it.unidade,
      preco: it.preco_unitario,
      desc:  it.desconto_item,
      tipo:  it.tipo_item,
      seg:   it.segmento_id  ?? null,
      amb:   it.ambiente_id  ?? null,
      obs:   it.observacao   ?? null,
      ordem: it.ordem_exibicao,
    }))
  );

/** Agrupa itens por (segmento_id + ambiente_id/ambiente_nome) ordenando grupos pelo menor
 *  ordem_exibicao do grupo; dentro de cada grupo ordena por ordem_exibicao crescente.
 *  mao_de_obra e cabos sempre ficam no final, ordenados entre si por ordem_exibicao. */
function groupSortItens<T extends Pick<Item, "tipo_item"|"segmento_id"|"ambiente_id"|"ambiente_nome"|"ordem_exibicao">>(items: T[]): T[] {
  const SPECIAL   = (tipo: string) => tipo === "mao_de_obra" || tipo === "cabos";
  const groupKey  = (it: T) => `${it.segmento_id ?? ""}|||${it.ambiente_id ?? it.ambiente_nome ?? ""}`;
  const normal    = items.filter(it => !SPECIAL(it.tipo_item));
  const special   = items.filter(it =>  SPECIAL(it.tipo_item));
  const groupMin: Record<string, number> = {};
  for (const it of normal) {
    const k = groupKey(it);
    if (!(k in groupMin) || it.ordem_exibicao < groupMin[k]) groupMin[k] = it.ordem_exibicao;
  }
  const sortedNormal = [...normal].sort((a, b) => {
    const d = groupMin[groupKey(a)] - groupMin[groupKey(b)];
    return d !== 0 ? d : a.ordem_exibicao - b.ordem_exibicao;
  });
  return [...sortedNormal, ...[...special].sort((a, b) => a.ordem_exibicao - b.ordem_exibicao)];
}

const blankItem = (ordem: number): Item => ({
  segmento_id: null,
  ambiente_id: null,
  produto_id: null,
  produto_titulo: "",
  quantidade: 1,
  unidade: "un",
  preco_unitario: 0,
  desconto_item: 0,
  valor_total: 0,
  tipo_item: "venda_normal",
  observacao: "",
  ordem_exibicao: ordem,
});

const computeTotal = (it: Item) =>
  Math.max(0, it.quantidade * it.preco_unitario - it.desconto_item);

/** Tipos que entram no somatório e exibem campos de preço. */
const isPayingType = (tipo: string) => tipo === "venda_normal" || tipo === "mao_de_obra" || tipo === "cabos";

const ADD_NEW = "__add_new__";

/** Autocomplete para segmento — filtra por digitação, sem botão de novo. */
function SegmentoCombobox({ value, segmentos, onChange, disabled }: {
  value: string | null;
  segmentos: any[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = segmentos.find((s: any) => s.id === value);
  const filtered = !query ? segmentos : segmentos.filter((s: any) => s.nome.toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className="w-full justify-between font-normal h-9 text-sm px-3 disabled:opacity-60 disabled:cursor-not-allowed">
          <span className="truncate">{selected?.nome || <span className="text-muted-foreground">—</span>}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-52" align="start">
        <div className="p-2 border-b border-border">
          <input autoFocus placeholder="Buscar segmento..."
            className="w-full h-8 px-2 text-sm bg-transparent outline-none"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum resultado.</div>}
          {filtered.map((s: any) => (
            <button key={s.id} type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${s.id === value ? "bg-accent font-medium" : ""}`}
              onClick={() => { onChange(s.id); setOpen(false); setQuery(""); }}>
              {s.nome}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Persiste a versão da sessão de edição mesmo quando o componente remonta (ex: volta do /pdf).
// Limpo pelo OrcamentoIdPage ao desmontar (saída genuína do orçamento).
export const sessaoVersaoMap = new Map<string, string>();

export default function OrcamentoEditor({ orcamentoId }: { orcamentoId?: string }) {
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const isNew = !orcamentoId;

  const [clientes, setClientes] = useState<any[]>([]);
  const [segmentos, setSegmentos] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  // produto labels cache for combobox display
  const [produtoLabels, setProdutoLabels] = useState<Record<string, string>>({});
  // Kits carregados do banco (null = ainda não carregou)
  const [dbKits, setDbKits] = useState<any[] | null>(null);

  const [form, setForm] = useState<any>({
    cliente_id: "",
    nome_projeto: "",
    tipo_projeto: "residencial",
    status: "em_elaboracao",
    observacoes_internas: "",
    observacoes_cliente: "",
    prazo: "",
    garantia: "",
    condicoes_pagamento: "",
    desconto: 0,
  });

  const [itens, setItens] = useState<Item[]>([]);
  const [orcNumero, setOrcNumero] = useState<number | null>(null);
  const [orcVersao, setOrcVersao] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Dialog states
  const [clienteDlg, setClienteDlg] = useState(false);
  const [arqs, setArqs] = useState<any[]>([]);
  const [clienteForm, setClienteForm] = useState({
    nome_razao_social: "", cpf_cnpj: "", telefone: "", celular: "",
    email: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "",
    endereco_instalacao: "", arquiteto_id: "",
  });
  const [savingCliente, setSavingCliente]   = useState(false);
  const [clienteEmailErr, setClienteEmailErr] = useState(false);
  const [clienteCepLoading, setClienteCepLoading] = useState(false);
  const [clienteCepErr, setClienteCepErr]     = useState("");

  const isValidEmail = (v: string) => {
    if (!v.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim());
  };

  const handleClienteCep = async (raw: string) => {
    const masked = maskCep(raw);
    setClienteForm(prev => ({ ...prev, cep: masked }));
    setClienteCepErr("");
    if (masked.replace(/\D/g, "").length !== 8) return;
    setClienteCepLoading(true);
    const result = await fetchViaCep(masked);
    setClienteCepLoading(false);
    if (result === "not_found") { setClienteCepErr("CEP não encontrado."); return; }
    if (result === "error")     { setClienteCepErr("Erro ao buscar CEP."); return; }
    setClienteForm(prev => ({
      ...prev,
      endereco: result.logradouro || prev.endereco,
      bairro:   result.bairro     || prev.bairro,
      cidade:   result.localidade || prev.cidade,
      estado:   result.uf         || prev.estado,
    }));
  };

  // 2.2 — duplicate product dialog
  const [dupDlg, setDupDlg] = useState<{ open: boolean; idx: number; produto: any } | null>(null);

  // 2.3 — discount cap error
  const [descontoErr, setDescontoErr] = useState(false);
  const [descontoModo, setDescontoModo] = useState<"valor" | "pct">("valor");
  // Percentual digitado pelo usuário — fonte da verdade quando !== null.
  // null significa que o usuário digitou em R$ (ou ainda não editou).
  const [descontoPct, setDescontoPct] = useState<number | null>(null);

  const [ambDlg, setAmbDlg] = useState<{ open: boolean; itemIdx: number | null }>({ open: false, itemIdx: null });
  const [ambNome, setAmbNome] = useState("");

  // Kit dialog — 2 etapas (aberto) ou 3 etapas (fechado)
  const [kitDlg, setKitDlg] = useState(false);
  const [kitStep, setKitStep] = useState<"list" | "configure" | "confirm_closed">("list");
  const [kitSelecionadoRaw, setKitSelecionadoRaw] = useState<any>(null);
  const [kitSelecoes, setKitSelecoes] = useState<Record<string, string>>({});
  const [kitProdsDisponiveis, setKitProdsDisponiveis] = useState<Record<string, any[]>>({});
  const [kitProdsLoading, setKitProdsLoading] = useState(false);
  const [kitBuscas, setKitBuscas] = useState<Record<string, string>>({});
  const [kitFocused, setKitFocused] = useState<Record<string, boolean>>({});
  const [kitContexto, setKitContexto] = useState<{ segmento_id: string | null; ambiente_id: string | null }>({ segmento_id: null, ambiente_id: null });
  const [kitClosedProds, setKitClosedProds] = useState<any[]>([]);

  // Dialog: ordem dos grupos no PDF
  const [pdfOrderDlg, setPdfOrderDlg] = useState(false);
  const [pdfOrderStep, setPdfOrderStep] = useState<"choice" | "reorder">("choice");
  const [pdfGrupos, setPdfGrupos] = useState<{ seg: string; amb: string }[]>([]);
  const [pdfNavId, setPdfNavId] = useState<string>("");
  // ref: true = preview sem salvar, false = navegar para rota após save
  const pdfPreviewModeRef = useRef(false);
  // itens filtrados (sem linhas vazias) para usar na preview
  const pdfPreviewItensRef = useRef<Item[]>([]);
  const [visualizandoPdf, setVisualizandoPdf] = useState(false);
  const [visualizarAvisoDlg, setVisualizarAvisoDlg] = useState(false);

  // Dialog: itens sem produto ao gerar PDF
  const [emptyItemsDlg, setEmptyItemsDlg] = useState(false);

  // Auto-scroll para item recém-adicionado
  const pendingScrollIdx = useRef<number | null>(null);
  useEffect(() => {
    if (pendingScrollIdx.current === null) return;
    const idx = pendingScrollIdx.current;
    pendingScrollIdx.current = null;
    requestAnimationFrame(() => {
      document.querySelector(`[data-item-idx="${idx}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [itens]);

  // Agrupa por segmento+ambiente; mão de obra e cabos sempre no final
  const displayItens = useMemo(() =>
    groupSortItens(itens.map((it, _idx) => ({ ...it, _idx })))
  , [itens]);

  // Bug #7 — dirty state
  const loadedRef = useRef(false);
  const originalItensRef = useRef<string>("");
  const snapshotFormRef  = useRef<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef      = useRef(false);
  const reminderRef     = useRef<number | null>(null);
  const saveRef         = useRef<() => void>(() => {});
  const [unsavedDlg, setUnsavedDlg] = useState(false);
  const [clienteUnsavedDlg, setClienteUnsavedDlg] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, s, a, arq] = await Promise.all([
        supabase.from("clientes").select("id,nome_razao_social,numero_cliente").order("nome_razao_social"),
        supabase.from("segmentos").select("*").eq("status", true).order("ordem"),
        supabase.from("ambientes").select("*").eq("status", true).order("ordem"),
        supabase.from("arquitetos").select("id,nome").eq("status", true).order("nome"),
      ]);
      setClientes(c.data || []);
      // Ordem padrão dos segmentos no editor (não existe flag de ordem definida pelo usuário por ora).
      // Segmentos fora da lista mantêm a ordem relativa que veio do banco.
      const SEG_PRIO: Record<string, number> = { "automação": 1, "áudio e vídeo": 2, "rede wi-fi": 3, "aspiração": 4 };
      const segsOrdenados = (s.data || []).slice().sort((a: any, b: any) => {
        const pa = SEG_PRIO[a.nome?.toLowerCase()] ?? 999;
        const pb = SEG_PRIO[b.nome?.toLowerCase()] ?? 999;
        return pa !== pb ? pa - pb : (a.ordem ?? 0) - (b.ordem ?? 0);
      });
      setSegmentos(segsOrdenados);
      setAmbientes(a.data || []);
      setArqs(arq.data || []);

      // Carrega kits do banco; silencia erro caso a migration ainda não tenha rodado
      const { data: kitData, error: kitErr } = await supabase
        .from("kits")
        .select("id, nome, categoria, tipo, kit_itens(id, descricao, produto_codigo, quantidade, ordem, categoria_produto)")
        .eq("status", true)
        .order("nome");
      setDbKits(!kitErr && kitData?.length ? kitData : []);

      if (orcamentoId) {
        const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).single();
        if (orc) {
          setOrcNumero(orc.numero_orcamento ?? null);
          setOrcVersao(orc.versao ?? null);
          const formData = {
            cliente_id: orc.cliente_id,
            nome_projeto: orc.nome_projeto,
            tipo_projeto: orc.tipo_projeto,
            status: orc.status,
            observacoes_internas: orc.observacoes_internas || "",
            observacoes_cliente: orc.observacoes_cliente || "",
            prazo: orc.prazo || "",
            garantia: orc.garantia || "",
            condicoes_pagamento: orc.condicoes_pagamento || "",
            desconto: Number(orc.desconto) || 0,
          };
          setForm(formData);
          snapshotFormRef.current = JSON.stringify(formData);
        }
        const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem_exibicao");
        const list = (its || []).map((it: any) => ({
          ...it,
          quantidade: Number(it.quantidade),
          preco_unitario: Number(it.preco_unitario),
          desconto_item: Number(it.desconto_item),
          valor_total: Number(it.valor_total),
        }));
        setItens(list);
        originalItensRef.current = serializeItens(list);
        const labels: Record<string, string> = {};
        list.forEach((it: any) => {
          if (it.produto_id) labels[it.produto_id] = produtoLabel({
            titulo: it.produto_titulo,
            nome_fantasia: it.nome_fantasia,
            sku: it.produto_sku,
          });
        });
        setProdutoLabels(labels);
      }
      setLoading(false);
      // Permite que React processe todos os setState acima antes de ativar dirty tracking
      setTimeout(() => { loadedRef.current = true; }, 0);
    })();
  }, [orcamentoId]);

  // Bug #7 — marca dirty quando form ou itens mudam (após carga inicial)
  useEffect(() => {
    if (!loadedRef.current) return;
    setIsDirty(true);
  }, [form, itens]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém isDirtyRef em sincronia com o state (para uso no setInterval sem closure stale)
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Bug #7 — bloqueia fechar aba/recarregar quando há dados não salvos (desktop)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const valorBruto = useMemo(
    () => itens.filter(i => isPayingType(i.tipo_item)).reduce((s, i) => s + computeTotal(i), 0),
    [itens]
  );
  const valorFinal = Math.max(0, valorBruto - (Number(form.desconto) || 0));

  // Quando o total bruto muda e o usuário havia digitado em %, recalcula o R$ do desconto.
  useEffect(() => {
    if (descontoPct === null) return;
    const novoR = Math.round(valorBruto * descontoPct / 100 * 100) / 100;
    setForm(f => ({ ...f, desconto: novoR }));
    setDescontoErr(descontoPct > 30);
  }, [valorBruto]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItens(arr => arr.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.valor_total = computeTotal(merged);
      return merged;
    }));
  };

  const addItem = () => {
    // Se já existe uma linha sem produto, rola até ela em vez de criar outra
    const emptyIdx = itens.findIndex(i => !i.produto_id && !i.produto_titulo.trim() && i.tipo_item === "venda_normal");
    if (emptyIdx !== -1) {
      document
        .querySelector(`[data-item-idx="${emptyIdx}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    pendingScrollIdx.current = 0;
    setItens(arr => [
      blankItem(1),
      ...arr.map(it => ({ ...it, ordem_exibicao: it.ordem_exibicao + 1 })),
    ]);
  };

  const addMaoDeObra = () => {
    const servicos = ambientes.find((a: any) => a.nome?.toLowerCase() === "serviços");
    pendingScrollIdx.current = itens.length;
    setItens(arr => [...arr, {
      ...blankItem(arr.length),
      tipo_item: "mao_de_obra",
      ambiente_id: servicos?.id ?? null,
      produto_titulo: "Mão Obra - Instalação, responsabilidade técnica e acompanhamento",
    }]);
  };

  const addCabos = () => {
    const servicos = ambientes.find((a: any) => a.nome?.toLowerCase() === "serviços");
    pendingScrollIdx.current = itens.length;
    setItens(arr => [...arr, {
      ...blankItem(arr.length),
      tipo_item: "cabos",
      ambiente_id: servicos?.id ?? null,
      produto_titulo: "Cabos, conectores e terminais necessários para instalação.",
    }]);
  };

  const removeItem = (idx: number) => setItens(arr => arr.filter((_, i) => i !== idx));

  const applyProduto = (idx: number, p: any) => {
    const patch: Partial<Item> = {
      produto_id: p.id,
      produto_titulo: p.titulo,
      produto_sku: p.sku,
      nome_fantasia: p.nome_fantasia || null,
      unidade: p.unidade || "un",
      preco_unitario: Number(p.msrp) || 0,
    };
    // Se o item ainda não tem segmento, tenta inferir pela categoria do produto
    if (!itens[idx]?.segmento_id && p.categoria) {
      const match = segmentos.find(
        (s: any) => s.nome?.trim().toLowerCase() === (p.categoria as string).trim().toLowerCase()
      );
      if (match) patch.segmento_id = match.id;
    }
    updateItem(idx, patch);
    setProdutoLabels(prev => ({ ...prev, [p.id]: produtoLabel(p) }));
  };

  const onPickProduto = (idx: number, p: any) => {
    const isDup = itens.some((it, i) => i !== idx && it.produto_id === p.id);
    if (isDup) {
      setDupDlg({ open: true, idx, produto: p });
      return;
    }
    applyProduto(idx, p);
  };

  // ── Kit handlers ───────────────────────────────────────────────────────────
  const openKit = () => { setKitStep("list"); setKitDlg(true); };

  const onSelectKit = async (kit: any) => {
    setKitSelecionadoRaw(kit);

    // Resolve segmento_id a partir da categoria do kit (match por nome, case-insensitive)
    const segmentoMatch = segmentos.find(
      (s: any) => s.nome?.trim().toLowerCase() === (kit.categoria || "").trim().toLowerCase()
    );
    setKitContexto({ segmento_id: segmentoMatch?.id ?? null, ambiente_id: null });

    // Kit fechado: busca produtos por SKU e vai para etapa de confirmação
    if (kit.tipo === "fechado") {
      setKitProdsLoading(true);
      const skus = (kit.kit_itens || []).map((it: any) => it.produto_codigo).filter(Boolean) as string[];
      let prods: any[] = [];
      if (skus.length > 0) {
        const { data } = await supabase
          .from("produtos")
          .select("id, titulo, nome_fantasia, sku, msrp, unidade")
          .in("sku", skus)
          .eq("status", true);
        prods = data || [];
      }
      setKitClosedProds(prods);
      setKitProdsLoading(false);
      setKitStep("confirm_closed");
      return;
    }

    setKitSelecoes({});
    setKitBuscas({});
    setKitFocused({});
    setKitProdsLoading(true);

    const cats = [...new Set(
      (kit.kit_itens || []).map((it: any) => it.categoria_produto).filter(Boolean)
    )] as string[];

    const prodsMap: Record<string, any[]> = {};

    // Uma query por categoria — usa o campo "modelo" (não "categoria") que contém
    // os tipos de componente: "Subwoofer", "Amplificador", "Caixa Torre", etc.
    // Categorias que começam com "caixa" usam match parcial (%caixa%) para incluir
    // "Caixa Torre", "Caixa Embutida", "Caixa Externa", "Caixa Teto" etc. no mesmo slot.
    await Promise.all(cats.map(async (cat) => {
      const pattern = cat.toLowerCase().startsWith("caixa") ? "%caixa%" : cat;
      const { data } = await supabase
        .from("produtos")
        .select("id, titulo, nome_fantasia, sku, msrp, unidade, modelo")
        .filter("modelo", "ilike", pattern)
        .eq("status", true)
        .order("titulo");
      prodsMap[cat] = data || [];
    }));

    setKitProdsDisponiveis(prodsMap);
    setKitProdsLoading(false);
    setKitStep("configure");
  };

  const confirmKit = () => {
    const slots = [...(kitSelecionadoRaw?.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
    const allProds = Object.values(kitProdsDisponiveis).flat();
    const novosItens: Item[] = [];
    for (const slot of slots) {
      const prodId = kitSelecoes[slot.id];
      if (!prodId) continue;
      const prod = allProds.find((p: any) => p.id === prodId);
      if (!prod) continue;
      novosItens.push({
        segmento_id: kitContexto.segmento_id,
        ambiente_id: kitContexto.ambiente_id,
        kit_nome: kitSelecionadoRaw?.nome ?? null,
        produto_id: prod.id,
        produto_titulo: prod.titulo,
        produto_sku: prod.sku || null,
        nome_fantasia: prod.nome_fantasia || null,
        quantidade: slot.quantidade,
        unidade: prod.unidade || "un",
        preco_unitario: Number(prod.msrp) || 0,
        desconto_item: 0,
        valor_total: slot.quantidade * (Number(prod.msrp) || 0),
        tipo_item: "venda_normal",
        observacao: "",
        ordem_exibicao: itens.length + novosItens.length,
      });
    }
    const newLabels: Record<string, string> = {};
    novosItens.forEach(it => {
      if (it.produto_id) newLabels[it.produto_id] = produtoLabel({ titulo: it.produto_titulo, nome_fantasia: it.nome_fantasia, sku: it.produto_sku });
    });
    setProdutoLabels(prev => ({ ...prev, ...newLabels }));
    pendingScrollIdx.current = itens.length;
    setItens(arr => [...arr, ...novosItens]);
    setKitDlg(false);
    setKitStep("list");
    setKitSelecionadoRaw(null);
    setKitSelecoes({});
    setKitBuscas({});
    setKitFocused({});
    setKitProdsDisponiveis({});
    setKitContexto({ segmento_id: null, ambiente_id: null });
    toast.success(`${novosItens.length} item${novosItens.length !== 1 ? "ns" : ""} adicionados do kit "${kitSelecionadoRaw?.nome}"`);
  };

  const confirmClosedKit = () => {
    const kitNome = kitSelecionadoRaw?.nome;
    const slots = [...(kitSelecionadoRaw?.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
    const novosItens: Item[] = [];
    for (const slot of slots) {
      const prod = kitClosedProds.find((p: any) => p.sku === slot.produto_codigo);
      const precoUn = Number(prod?.msrp) || 0;
      novosItens.push({
        segmento_id: kitContexto.segmento_id,
        ambiente_id: kitContexto.ambiente_id,
        kit_nome: kitNome ?? null,
        produto_id: prod?.id || null,
        produto_titulo: prod?.titulo || slot.descricao,
        produto_sku: slot.produto_codigo || null,
        nome_fantasia: prod?.nome_fantasia || null,
        quantidade: slot.quantidade,
        unidade: prod?.unidade || "un",
        preco_unitario: precoUn,
        desconto_item: 0,
        valor_total: slot.quantidade * precoUn,
        tipo_item: "venda_normal",
        observacao: "",
        ordem_exibicao: itens.length + novosItens.length,
      });
    }
    const newLabels: Record<string, string> = {};
    novosItens.forEach(it => {
      if (it.produto_id) newLabels[it.produto_id] = produtoLabel({ titulo: it.produto_titulo, nome_fantasia: it.nome_fantasia, sku: it.produto_sku });
    });
    setProdutoLabels(prev => ({ ...prev, ...newLabels }));
    pendingScrollIdx.current = itens.length;
    setItens(arr => [...arr, ...novosItens]);
    setKitDlg(false);
    setKitStep("list");
    setKitSelecionadoRaw(null);
    setKitClosedProds([]);
    setKitContexto({ segmento_id: null, ambiente_id: null });
    toast.success(`${novosItens.length} item${novosItens.length !== 1 ? "ns" : ""} adicionados do kit "${kitNome}"`);
  };

  const saveCliente = async () => {
    if (!clienteForm.nome_razao_social.trim()) return toast.error("Informe o nome do cliente.");
    if (!isValidEmail(clienteForm.email)) {
      setClienteEmailErr(true);
      return toast.error("E-mail inválido.");
    }
    setSavingCliente(true);
    const { data, error } = await supabase.from("clientes").insert({
      ...clienteForm,
      arquiteto_id: clienteForm.arquiteto_id || null,
      created_by: user!.id,
    }).select("id,nome_razao_social,numero_cliente").single();
    setSavingCliente(false);
    if (error) return toast.error(error.message);
    setClientes(arr => [...arr, data].sort((a, b) => a.nome_razao_social.localeCompare(b.nome_razao_social)));
    setForm((f: any) => ({ ...f, cliente_id: data.id }));
    setErrors(e => ({ ...e, cliente_id: false }));
    setClienteForm({ nome_razao_social: "", cpf_cnpj: "", telefone: "", celular: "", email: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "", endereco_instalacao: "", arquiteto_id: "" });
    setClienteEmailErr(false); setClienteCepErr("");
    setClienteDlg(false);
    toast.success(`Cliente #${data.numero_cliente} cadastrado`);
  };

  const saveAmbiente = () => {
    if (!ambNome.trim()) return toast.error("Informe o nome do ambiente.");
    if (ambDlg.itemIdx !== null) updateItem(ambDlg.itemIdx, { ambiente_id: null, ambiente_nome: ambNome.trim() });
    setAmbNome("");
    setAmbDlg({ open: false, itemIdx: null });
    toast.success("Ambiente personalizado definido");
  };

  /** Remove itens em branco (sem produto e sem tipo mao_de_obra/cabos), atualiza estado e chama save(true). */
  const confirmRemoveEmpty = () => {
    const filtered = itens.filter(it =>
      it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos" || it.produto_id || it.produto_titulo?.trim()
    );
    setItens(filtered);
    setEmptyItemsDlg(false);
    save(true, filtered);
  };

  const extractGruposPdf = (items: Item[]) => {
    const seen = new Set<string>();
    const groups: { seg: string; amb: string }[] = [];
    for (const it of items) {
      const segNome = (segmentos.find((s: any) => s.id === it.segmento_id)?.nome ?? "GERAL").toUpperCase();
      const ambNome = (it.ambiente_nome ?? ambientes.find((a: any) => a.id === it.ambiente_id)?.nome ?? "GERAL").toUpperCase();
      const key = `${segNome}|||${ambNome}`;
      if (!seen.has(key)) { seen.add(key); groups.push({ seg: segNome, amb: ambNome }); }
    }
    // Consolida: pares do mesmo seg ficam adjacentes, ordem de 1ª aparição do seg preservada
    const segOrder: string[] = [];
    const segMap: Record<string, typeof groups> = {};
    for (const g of groups) {
      if (!segMap[g.seg]) { segOrder.push(g.seg); segMap[g.seg] = []; }
      segMap[g.seg].push(g);
    }
    return segOrder.flatMap(seg => segMap[seg]);
  };

  const openPdfFlow = (id: string, items?: Item[]) => {
    pdfPreviewModeRef.current = false;
    const grupos = extractGruposPdf(items ?? itens);
    if (grupos.length <= 1) {
      nav({ to: "/orcamentos/$id/pdf", params: { id }, search: {} });
      return;
    }
    setPdfNavId(id);
    setPdfGrupos(grupos);
    setPdfOrderStep("choice");
    setPdfOrderDlg(true);
  };

  const navigateToPdf = (grupos: { seg: string; amb: string }[]) => {
    const search = grupos.length
      ? { groupOrder: JSON.stringify(grupos.map(g => `${g.seg}|||${g.amb}`)) }
      : {};
    nav({ to: "/orcamentos/$id/pdf", params: { id: pdfNavId }, search });
    setPdfOrderDlg(false);
  };

  /** Gera PDF em memória com o estado atual da tela — sem salvar, sem tocar no banco. */
  const gerarPreviewComGrupos = async (grupos: { seg: string; amb: string }[]) => {
    setPdfOrderDlg(false);
    setVisualizandoPdf(true);
    try {
      const groupOrderStr = grupos.length > 0
        ? JSON.stringify(grupos.map(g => `${g.seg}|||${g.amb}`))
        : undefined;

      const activeItens = pdfPreviewItensRef.current;

      // Três SELECTs de leitura — sem escrita no banco
      const [orcRes, clienteRes, vendedorRes] = await Promise.all([
        supabase.from("orcamentos")
          .select("numero_orcamento, versao, created_at")
          .eq("id", orcamentoId!)
          .single(),
        supabase.from("clientes")
          .select("*, arquitetos(nome,empresa,telefone,email)")
          .eq("id", form.cliente_id)
          .single(),
        supabase.from("profiles")
          .select("nome,email,celular")
          .eq("id", user!.id)
          .single(),
      ]);

      if (!orcRes.data)    throw new Error("Orçamento não encontrado.");
      if (!clienteRes.data) throw new Error("Cliente não encontrado.");

      const pdfOrc: PdfOrcamento = {
        numero_orcamento:   orcRes.data.numero_orcamento,
        versao:             orcRes.data.versao,
        status:             form.status,
        desconto:           Number(form.desconto) || 0,
        valor_final:        valorFinal,
        condicoes_pagamento: form.condicoes_pagamento || null,
        prazo:              form.prazo || null,
        garantia:           form.garantia || null,
        observacoes_cliente: form.observacoes_cliente || null,
        created_at:         orcRes.data.created_at,
        clientes:           clienteRes.data,
      };

      const pdfItens: PdfItem[] = activeItens.map(it => ({
        segmento_nome: segmentos.find((s: any) => s.id === it.segmento_id)?.nome ?? "GERAL",
        ambiente_nome: it.ambiente_nome ?? ambientes.find((a: any) => a.id === it.ambiente_id)?.nome ?? "GERAL",
        nome_fantasia:  it.nome_fantasia ?? null,
        produto_titulo: it.produto_titulo,
        observacao:     it.observacao ?? null,
        quantidade:     it.quantidade,
        tipo_item:      it.tipo_item,
        preco_unitario: it.preco_unitario,
        valor_total:    it.valor_total,
        desconto_item:  it.desconto_item,
      }));

      const blob = await gerarPdfBlob(pdfOrc, pdfItens, vendedorRes.data ?? null, groupOrderStr);
      const nome = pdfFileName(clienteRes.data.nome_razao_social, orcRes.data.numero_orcamento, orcRes.data.versao);
      abrirBlobPdf(blob, nome);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF.");
    } finally {
      setVisualizandoPdf(false);
    }
  };

  /** Abre visualização do PDF com o estado atual da tela — sem salvar. */
  const visualizarPdf = () => {
    if (!form.cliente_id) return toast.error("Selecione um cliente antes de visualizar o PDF.");
    // Filtra itens vazios silenciosamente (não modifica o estado)
    const cleanItens = itens.filter(it =>
      it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos" || it.produto_id || it.produto_titulo?.trim()
    );
    pdfPreviewModeRef.current = true;
    pdfPreviewItensRef.current = cleanItens;
    const grupos = extractGruposPdf(cleanItens);
    if (grupos.length <= 1) {
      gerarPreviewComGrupos(grupos);
      return;
    }
    setPdfNavId(orcamentoId!);
    setPdfGrupos(grupos);
    setPdfOrderStep("choice");
    setPdfOrderDlg(true);
  };

  const movePdfGrupo = (i: number, dir: -1 | 1) => {
    const arr = [...pdfGrupos];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPdfGrupos(arr);
  };

  // Reinicia (ou inicia) o timer de lembrete de alterações não salvas
  const startReminder = () => {
    if (reminderRef.current !== null) clearInterval(reminderRef.current);
    reminderRef.current = window.setInterval(() => {
      if (!isDirtyRef.current) return;
      toast("Você tem alterações não salvas.", {
        id: "unsaved-reminder",
        description: "Salve para não perder o trabalho.",
        action: { label: "Salvar agora", onClick: () => saveRef.current() },
        duration: 30_000,
      });
    }, 5 * 60 * 1000);
  };

  const save = async (goPdf = false, overrideItens?: Item[]) => {
    const errs: Record<string, boolean> = {};
    if (!form.cliente_id) errs.cliente_id = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Preencha os campos destacados em vermelho.");

    // Ao ir para PDF, verifica se há itens sem produto selecionado
    if (goPdf && !overrideItens) {
      const empties = itens.filter(
        it => it.tipo_item !== "mao_de_obra" && it.tipo_item !== "cabos" && !it.produto_id && !it.produto_titulo?.trim()
      );
      if (empties.length > 0) { setEmptyItemsDlg(true); return; }
    }

    // Nada mudou desde a última carga/save — evita incrementar versão desnecessariamente.
    // Usa refs para comparação determinística (sem depender do isDirty que tem race condition).
    if (!isNew && !overrideItens) {
      const itensToCheck = overrideItens ?? itens;
      const formChanged  = JSON.stringify(form) !== snapshotFormRef.current;
      const itensChanged = serializeItens(itensToCheck) !== originalItensRef.current;
      if (!formChanged && !itensChanged) {
        if (goPdf) openPdfFlow(orcamentoId!);
        else toast.info("Nenhuma alteração para salvar.");
        return;
      }
    }

    // 2.3 — block save if discount exceeds 30 %
    const maxDesc = valorBruto * 0.30;
    if (Number(form.desconto) > maxDesc) {
      setDescontoErr(true);
      return toast.error("Desconto não autorizado — máximo 30% do valor bruto.");
    }
    setSaving(true);

    const payload = {
      ...form,
      desconto: Number(form.desconto) || 0,
      valor_bruto: valorBruto,
      valor_final: valorFinal,
      vendedor_id: user!.id,
    };

    const itensToSave = overrideItens ?? itens;
    let id = orcamentoId;
    let numero: number | undefined;
    let novaVersao: string | null = null;

    if (isNew) {
      const { data, error } = await supabase.from("orcamentos").insert(payload).select().single();
      if (error) { setSaving(false); return toast.error(error.message); }
      id = data.id;
      numero = data.numero_orcamento;
    } else {
      numero = orcNumero!;

      // Versão de sessão: incrementa apenas na 1ª vez que salva após abrir a tela.
      // Saves subsequentes (manual, lembrete ou retorno do /pdf) reutilizam a mesma letra.
      if (sessaoVersaoMap.has(orcamentoId!)) {
        novaVersao = sessaoVersaoMap.get(orcamentoId!)!;
      } else {
        const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const curIdx = orcVersao ? LETRAS.indexOf(orcVersao) : -1;
        novaVersao = LETRAS[Math.min(curIdx + 1, 25)] ?? "A";
        sessaoVersaoMap.set(orcamentoId!, novaVersao);
      }

      const { error: updErr } = await supabase
        .from("orcamentos")
        .update({ ...payload, versao: novaVersao })
        .eq("id", orcamentoId!);
      if (updErr) { setSaving(false); return toast.error(updErr.message); }
    }

    // Para edição: substitui os itens existentes (delete + insert)
    if (!isNew) {
      const { error: delErr } = await supabase
        .from("orcamento_itens")
        .delete()
        .eq("orcamento_id", id!);
      if (delErr) { setSaving(false); return toast.error(delErr.message); }
    }

    if (itensToSave.length) {
      const sorted = groupSortItens([...itensToSave]);
      const insertable = sorted.map((it, i) => ({
        orcamento_id: id!,
        segmento_id: it.segmento_id,
        ambiente_id: it.ambiente_id,
        ambiente_nome: it.ambiente_nome ?? null,
        kit_nome: it.kit_nome ?? null,
        produto_id: it.produto_id,
        produto_titulo: it.produto_titulo || (it.tipo_item === "venda_normal" ? "Item" : ""),
        produto_sku: it.produto_sku,
        quantidade: it.quantidade,
        unidade: it.unidade,
        preco_unitario: it.preco_unitario,
        desconto_item: it.desconto_item,
        valor_total: it.valor_total,
        tipo_item: it.tipo_item as any,
        observacao: it.observacao,
        ordem_exibicao: i,
      }));
      const { error } = await supabase.from("orcamento_itens").insert(insertable);
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    setSaving(false);
    setIsDirty(false);
    if (numero != null) setOrcNumero(numero);
    setOrcVersao(novaVersao);
    // Atualiza snapshots para que um segundo save sem mudanças não incremente versão
    snapshotFormRef.current  = JSON.stringify(form);
    originalItensRef.current = serializeItens(itensToSave);
    const numDisplay = numero != null ? fmtOrcNumV(numero, novaVersao) : "";
    toast.success(numDisplay ? `Orçamento ${numDisplay} salvo` : "Orçamento salvo");
    startReminder(); // reinicia o timer — próximo aviso só após 5 min do último save
    if (goPdf) openPdfFlow(id!, overrideItens);
    else if (!isNew) { /* permanece na mesma página */ }
    else nav({ to: "/orcamentos/$id", params: { id: id! } });
  };

  // Mantém saveRef apontando para o save atual para o interval não capturar closure stale
  useEffect(() => { saveRef.current = () => save(); }); // eslint-disable-line react-hooks/exhaustive-deps

  // Inicia o timer de lembrete ao montar; reinicia ao salvar (via startReminder dentro de save)
  useEffect(() => {
    startReminder();
    return () => { if (reminderRef.current !== null) clearInterval(reminderRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 pb-24 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <Button
            variant="ghost" size="sm" className="mb-2 -ml-3"
            onClick={() => isDirty ? setUnsavedDlg(true) : nav({ to: "/orcamentos" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {isNew ? "Novo orçamento" : "Editar orçamento"}
          </h1>
          {!isNew && orcNumero != null && (
            <p className="text-base font-mono font-semibold text-primary mt-0.5">
              #{fmtOrcNumV(orcNumero, orcVersao)}
            </p>
          )}
        </div>
        <div className="flex gap-2 sm:flex-row flex-wrap">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          {!isNew && orcamentoId && (
            <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => setVisualizarAvisoDlg(true)} disabled={visualizandoPdf}>
              {visualizandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">Visualizar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          )}
          <Button className="flex-1 sm:flex-initial" onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Salvar e abrir PDF</span>
            <span className="sm:hidden">Salvar+PDF</span>
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label>Cliente *</Label>
            <div className="flex gap-2">
              <div className={errors.cliente_id ? "flex-1 ring-2 ring-destructive rounded-md" : "flex-1"}>
                <Select value={form.cliente_id} onValueChange={(v) => { setForm({ ...form, cliente_id: v }); setErrors(e => ({ ...e, cliente_id: false })); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum cliente. Use o botão ao lado.</div>
                    )}
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={() => { setClienteForm({ nome_razao_social: "", cpf_cnpj: "", telefone: "", celular: "", email: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "", endereco_instalacao: "", arquiteto_id: "" }); setClienteEmailErr(false); setClienteCepErr(""); setClienteDlg(true); }} title="Cadastrar novo cliente">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Tipo de projeto</Label>
            <Select value={form.tipo_projeto} onValueChange={(v) => setForm({ ...form, tipo_projeto: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="corporativo">Corporativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Nome do projeto</Label>
            <Input
              value={form.nome_projeto}
              onChange={(e) => setForm({ ...form, nome_projeto: e.target.value })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prazo</Label>
            <Input value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} placeholder="Ex.: 30 dias úteis" />
          </div>
          <div className="md:col-span-2">
            <Label>Garantia</Label>
            <Input value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} placeholder="Ex.: 12 meses contra defeito de fabricação" />
          </div>
          <div className="md:col-span-2">
            <Label>Condições de pagamento</Label>
            <Input value={form.condicoes_pagamento} onChange={(e) => setForm({ ...form, condicoes_pagamento: e.target.value })} placeholder="Ex.: 50% na aprovação, 50% na entrega" />
          </div>
          <div className="md:col-span-3 grid md:grid-cols-2 gap-4">
            <div>
              <Label>Observações de Projeto</Label>
              <Textarea rows={3} value={form.observacoes_cliente} onChange={(e) => setForm({ ...form, observacoes_cliente: e.target.value })} />
            </div>
            <div>
              <Label>Observações internas (não vão no PDF)</Label>
              <Textarea rows={3} value={form.observacoes_internas} onChange={(e) => setForm({ ...form, observacoes_internas: e.target.value })} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">Itens do orçamento</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={openKit}><Package className="h-4 w-4 mr-2" /> Adicionar kit</Button>
            <Button size="sm" className="flex-1 sm:flex-initial" onClick={addItem}><Plus className="h-4 w-4 mr-2" /> Adicionar item</Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={addMaoDeObra}><Wrench className="h-4 w-4 mr-2" /> Mão de obra</Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={addCabos}><Cable className="h-4 w-4 mr-2" /> Cabos</Button>
          </div>
        </div>

        {/* ── Mobile: cards empilhados ── */}
        <div className="flex flex-col gap-3 md:hidden">
          {itens.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item ainda. Clique em "Adicionar item".</p>
          )}
          {displayItens.map((it) => { const idx = it._idx; return (it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos") ? (
            /* ── Card mão de obra / cabos (mobile) ── */
            <div key={idx} data-item-idx={idx} className="border border-primary/30 rounded-lg p-3 space-y-2 bg-card">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {it.tipo_item === "mao_de_obra"
                    ? <Wrench className="h-3.5 w-3.5 text-primary" />
                    : <Cable className="h-3.5 w-3.5 text-primary" />}
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {it.tipo_item === "mao_de_obra" ? "Mão de obra" : "Cabos"}
                  </span>
                  <Input type="number" min="1" className="h-6 w-12 text-center text-xs p-1" value={it.ordem_exibicao} onChange={(e) => updateItem(idx, { ordem_exibicao: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Segmento</Label>
                <SegmentoCombobox value={it.segmento_id} segmentos={segmentos} onChange={(id) => updateItem(idx, { segmento_id: id, produto_id: null, produto_titulo: "", produto_sku: null, nome_fantasia: null, unidade: "un", preco_unitario: 0 })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ambiente</Label>
                <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v, ambiente_nome: null }); }}>
                  <SelectTrigger><SelectValue placeholder={it.ambiente_nome || "—"} /></SelectTrigger>
                  <SelectContent>
                    {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Descrição</Label>
                <Input
                  className="h-9"
                  placeholder={it.tipo_item === "mao_de_obra" ? "Ex.: Mão de obra - Automação" : "Ex.: Cabos e infraestrutura"}
                  value={it.produto_titulo}
                  onChange={(e) => updateItem(idx, { produto_titulo: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Quantidade</Label>
                <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Valor</Label>
                <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <Label className="text-xs text-muted-foreground">Total</Label>
                <p className="font-semibold text-sm">{brl(it.valor_total)}</p>
              </div>
            </div>
          ) : (
            /* ── Card produto normal (mobile) ── */
            <div key={idx} data-item-idx={idx} className="border border-border rounded-lg p-3 space-y-2 bg-card">
              {it.kit_nome && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
                  <Package className="h-2.5 w-2.5 shrink-0" />{it.kit_nome}
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ord.</span>
                  <Input type="number" min="1" className="h-6 w-12 text-center text-xs p-1" value={it.ordem_exibicao} onChange={(e) => updateItem(idx, { ordem_exibicao: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Segmento</Label>
                <SegmentoCombobox value={it.segmento_id} segmentos={segmentos} onChange={(id) => updateItem(idx, { segmento_id: id, produto_id: null, produto_titulo: "", produto_sku: null, nome_fantasia: null, unidade: "un", preco_unitario: 0 })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ambiente</Label>
                <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v, ambiente_nome: null }); }}>
                  <SelectTrigger><SelectValue placeholder={it.ambiente_nome || "—"} /></SelectTrigger>
                  <SelectContent>
                    {ambientes.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum ambiente. Peça ao admin.</div>}
                    {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Produto</Label>
                {it.tipo_item === "cliente" ? (
                  <Input
                    className="h-9"
                    placeholder="Nome do produto do cliente..."
                    value={it.produto_titulo}
                    title={it.produto_titulo || undefined}
                    onChange={(e) => updateItem(idx, { produto_titulo: e.target.value, produto_id: null, produto_sku: null, nome_fantasia: null })}
                  />
                ) : (
                  <ProdutoCombobox value={it.produto_id} selectedLabel={it.produto_id ? (produtoLabels[it.produto_id] || it.produto_titulo || it.produto_sku || null) : null} categoriaFilter={segmentos.find(s => s.id === it.segmento_id)?.nome ?? null} onSelect={(p) => onPickProduto(idx, p)} />
                )}
                <Input className="mt-1 h-8 text-xs" placeholder="Observação (opcional)" value={it.observacao || ""} onChange={(e) => updateItem(idx, { observacao: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Tipo</Label>
                <Select value={it.tipo_item} onValueChange={(v) => {
                  const patch: Partial<Item> = { tipo_item: v };
                  if (v === "cliente") {
                    patch._prevProdutoId = it.produto_id; patch._prevTitulo = it.produto_titulo;
                    patch._prevSku = it.produto_sku ?? null; patch._prevNomefantasia = it.nome_fantasia ?? null;
                    patch.produto_id = null; patch.produto_sku = null; patch.nome_fantasia = null;
                  } else if (it.tipo_item === "cliente") {
                    patch.produto_id = it._prevProdutoId ?? null; patch.produto_titulo = it._prevTitulo ?? "";
                    patch.produto_sku = it._prevSku ?? null; patch.nome_fantasia = it._prevNomefantasia ?? null;
                    patch._prevProdutoId = null; patch._prevTitulo = ""; patch._prevSku = null; patch._prevNomefantasia = null;
                  }
                  updateItem(idx, patch);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ITEM_LABELS).filter(([k]) => k !== "mao_de_obra" && k !== "cabos").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Quantidade</Label>
                <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
              </div>
              {isPayingType(it.tipo_item) && (
                <>
                  <div>
                    <Label className="text-xs mb-1 block">Preço un.</Label>
                    <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <Label className="text-xs text-muted-foreground">Total</Label>
                    <p className="font-semibold text-sm">{brl(it.valor_total)}</p>
                  </div>
                </>
              )}
            </div>
          )})}
        </div>

        {/* ── Desktop: tabela horizontal ── */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[46px] text-center">Ord.</TableHead>
                <TableHead className="w-[160px]">Segmento</TableHead>
                <TableHead className="w-[160px]">Ambiente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[130px]">Tipo</TableHead>
                <TableHead className="w-[70px]">Qtd</TableHead>
                <TableHead className="w-[160px]">Preço un.</TableHead>
                <TableHead className="w-[160px] text-right">Total</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum item ainda. Clique em "Adicionar item".</TableCell></TableRow>
              )}
              {displayItens.map((it) => { const idx = it._idx; return (it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos") ? (
                /* ── Linha mão de obra / cabos (desktop) — com segmento e ambiente ── */
                <TableRow key={idx} data-item-idx={idx} className="bg-primary/5">
                  <TableCell className="w-[46px]">
                    <Input type="number" min="1" className="h-8 w-10 text-center text-xs p-1" value={it.ordem_exibicao} onChange={(e) => updateItem(idx, { ordem_exibicao: Math.max(1, Number(e.target.value) || 1) })} />
                  </TableCell>
                  <TableCell>
                    <SegmentoCombobox value={it.segmento_id} segmentos={segmentos} onChange={(id) => updateItem(idx, { segmento_id: id })} />
                  </TableCell>
                  <TableCell>
                    <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v, ambiente_nome: null }); }}>
                      <SelectTrigger><SelectValue placeholder={it.ambiente_nome || "—"} /></SelectTrigger>
                      <SelectContent>
                        {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-9 text-sm"
                      placeholder={it.tipo_item === "mao_de_obra" ? "Descrição da mão de obra..." : "Descrição dos cabos..."}
                      value={it.produto_titulo}
                      onChange={(e) => updateItem(idx, { produto_titulo: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground italic">
                      {it.tipo_item === "mao_de_obra" ? "Mão de obra" : "Cabos"}
                    </span>
                  </TableCell>
                  <TableCell className="w-[70px]">
                    <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </TableCell>
                  <TableCell className="w-[160px]">
                    <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
                  </TableCell>
                  <TableCell className="w-[160px] text-right font-medium">{brl(it.valor_total)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ) : (
                /* ── Linha produto normal (desktop) ── */
                <TableRow key={idx} data-item-idx={idx}>
                  <TableCell className="w-[46px]">
                    <Input type="number" min="1" className="h-8 w-10 text-center text-xs p-1" value={it.ordem_exibicao} onChange={(e) => updateItem(idx, { ordem_exibicao: Math.max(1, Number(e.target.value) || 1) })} />
                  </TableCell>
                  <TableCell>
                    <SegmentoCombobox value={it.segmento_id} segmentos={segmentos} onChange={(id) => updateItem(idx, { segmento_id: id, produto_id: null, produto_titulo: "", produto_sku: null, nome_fantasia: null, unidade: "un", preco_unitario: 0 })} />
                  </TableCell>
                  <TableCell>
                    <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v, ambiente_nome: null }); }}>
                      <SelectTrigger><SelectValue placeholder={it.ambiente_nome || "—"} /></SelectTrigger>
                      <SelectContent>
                        {ambientes.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum ambiente. Peça ao admin.</div>}
                        {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {it.tipo_item === "cliente" ? (
                      <Input
                        className="h-9 text-sm"
                        placeholder="Nome do produto do cliente..."
                        value={it.produto_titulo}
                        title={it.produto_titulo || undefined}
                        onChange={(e) => updateItem(idx, { produto_titulo: e.target.value, produto_id: null, produto_sku: null, nome_fantasia: null })}
                      />
                    ) : (
                      <>
                        <ProdutoCombobox value={it.produto_id} selectedLabel={it.produto_id ? (produtoLabels[it.produto_id] || it.produto_titulo || it.produto_sku || null) : null} categoriaFilter={segmentos.find(s => s.id === it.segmento_id)?.nome ?? null} onSelect={(p) => onPickProduto(idx, p)} />
                        {it.kit_nome && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            <Package className="h-2.5 w-2.5 shrink-0" />{it.kit_nome}
                          </span>
                        )}
                      </>
                    )}
                    <Input className="mt-1 h-8 text-xs" placeholder="Observação (opcional)" value={it.observacao || ""} onChange={(e) => updateItem(idx, { observacao: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Select value={it.tipo_item} onValueChange={(v) => {
                      const patch: Partial<Item> = { tipo_item: v };
                      if (v === "cliente") {
                        patch._prevProdutoId = it.produto_id; patch._prevTitulo = it.produto_titulo;
                        patch._prevSku = it.produto_sku ?? null; patch._prevNomefantasia = it.nome_fantasia ?? null;
                        patch.produto_id = null; patch.produto_sku = null; patch.nome_fantasia = null;
                      } else if (it.tipo_item === "cliente") {
                        patch.produto_id = it._prevProdutoId ?? null; patch.produto_titulo = it._prevTitulo ?? "";
                        patch.produto_sku = it._prevSku ?? null; patch.nome_fantasia = it._prevNomefantasia ?? null;
                        patch._prevProdutoId = null; patch._prevTitulo = ""; patch._prevSku = null; patch._prevNomefantasia = null;
                      }
                      updateItem(idx, patch);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_ITEM_LABELS).filter(([k]) => k !== "mao_de_obra" && k !== "cabos").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="w-[70px]">
                    <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </TableCell>
                  <TableCell className="w-[160px]">
                    {isPayingType(it.tipo_item)
                      ? <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
                      : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="w-[160px] text-right font-medium">
                    {isPayingType(it.tipo_item)
                      ? brl(it.valor_total)
                      : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4 md:p-6 mb-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor bruto</span>
              <span>{brl(valorBruto)}</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm text-muted-foreground">Desconto geral</span>
              <div className="flex items-center gap-1">
                {/* Toggle R$ / % */}
                <Button type="button" size="sm" variant={descontoModo === "valor" ? "default" : "outline"}
                  className="h-8 w-8 p-0 text-xs" onClick={() => setDescontoModo("valor")}>R$</Button>
                <Button type="button" size="sm" variant={descontoModo === "pct" ? "default" : "outline"}
                  className="h-8 w-8 p-0 text-xs" onClick={() => setDescontoModo("pct")}>%</Button>
                {descontoModo === "pct" ? (
                  <div className="relative w-24">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className={`h-9 w-full rounded-md border bg-background px-3 pr-6 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring${descontoErr ? " border-destructive focus:ring-destructive" : " border-input"}`}
                      value={descontoPct !== null ? descontoPct : (valorBruto > 0 ? Number(((Number(form.desconto) / valorBruto) * 100).toFixed(2)) : 0)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        const v = Math.round(valorBruto * pct / 100 * 100) / 100;
                        setDescontoPct(pct);
                        setForm({ ...form, desconto: v });
                        setDescontoErr(pct > 30);
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                  </div>
                ) : (
                  <CurrencyInput
                    className={`w-32 text-right${descontoErr ? " border-destructive focus-visible:ring-destructive" : ""}`}
                    value={Number(form.desconto) || 0}
                    onChange={(v) => {
                      setDescontoPct(null);
                      setForm({ ...form, desconto: v });
                      setDescontoErr(v > valorBruto * 0.30);
                    }}
                  />
                )}
              </div>
            </div>
            {descontoErr && (
              <p className="text-xs text-destructive text-right font-semibold">
                Desconto não autorizado — máximo 30%
              </p>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Valor final</span>
              <span className="text-primary">{brl(valorFinal)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Dialog: aviso antes de visualizar PDF */}
      <Dialog open={visualizarAvisoDlg} onOpenChange={setVisualizarAvisoDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Visualizar PDF</DialogTitle>
            <DialogDescription>
              Esta é apenas uma visualização. Lembre-se de salvar antes de finalizar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setVisualizarAvisoDlg(false)}>Cancelar</Button>
            <Button onClick={() => { setVisualizarAvisoDlg(false); visualizarPdf(); }}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: novo cliente */}
      <Dialog open={clienteDlg} onOpenChange={(o) => {
        if (!o) {
          const hasData = Object.values(clienteForm).some(v => typeof v === "string" && v.trim() !== "");
          if (hasData) { setClienteUnsavedDlg(true); return; }
        }
        setClienteDlg(o);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre rapidamente. Você pode completar os dados depois em Clientes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {/* Nome */}
            <div>
              <Label>Nome / Razão social *</Label>
              <Input value={clienteForm.nome_razao_social} onChange={(e) => setClienteForm({ ...clienteForm, nome_razao_social: e.target.value })} />
            </div>

            {/* CPF/CNPJ + Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>CPF / CNPJ</Label>
                <Input value={clienteForm.cpf_cnpj}
                  onChange={(e) => setClienteForm({ ...clienteForm, cpf_cnpj: maskCpfCnpj(e.target.value) })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  maxLength={18} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={clienteForm.telefone} placeholder="(15) 3224-2316" maxLength={15} onChange={(e) => setClienteForm({ ...clienteForm, telefone: maskPhone(e.target.value) })} />
              </div>
            </div>

            {/* Celular + E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Celular</Label>
                <Input value={clienteForm.celular} placeholder="(15) 99999-9999" maxLength={15} onChange={(e) => setClienteForm({ ...clienteForm, celular: maskPhone(e.target.value) })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="text"
                  value={clienteForm.email}
                  onChange={(e) => {
                    setClienteForm({ ...clienteForm, email: e.target.value });
                    if (clienteEmailErr) setClienteEmailErr(!isValidEmail(e.target.value));
                  }}
                  onBlur={(e) => setClienteEmailErr(!isValidEmail(e.target.value))}
                  className={clienteEmailErr ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {clienteEmailErr && (
                  <p className="text-xs text-destructive mt-1">E-mail inválido. Use o formato nome@dominio.com</p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div>
              <Label>Endereço</Label>
              <Input value={clienteForm.endereco} onChange={(e) => setClienteForm({ ...clienteForm, endereco: e.target.value })} />
            </div>

            {/* Bairro + CEP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input value={clienteForm.bairro} onChange={(e) => setClienteForm({ ...clienteForm, bairro: e.target.value })} />
              </div>
              <div>
                <Label>CEP</Label>
                <div className="relative">
                  <Input value={clienteForm.cep}
                    onChange={(e) => handleClienteCep(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={clienteCepErr ? "border-destructive focus-visible:ring-destructive pr-8" : "pr-8"}
                  />
                  {clienteCepLoading && (
                    <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
                {clienteCepErr && <p className="text-xs text-destructive mt-1">{clienteCepErr}</p>}
              </div>
            </div>

            {/* Cidade + Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={clienteForm.cidade} onChange={(e) => setClienteForm({ ...clienteForm, cidade: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={clienteForm.estado} onChange={(e) => setClienteForm({ ...clienteForm, estado: e.target.value })} />
              </div>
            </div>

            {/* Endereço de instalação */}
            <div>
              <Label>Endereço da obra / instalação</Label>
              <Input value={clienteForm.endereco_instalacao} onChange={(e) => setClienteForm({ ...clienteForm, endereco_instalacao: e.target.value })} />
            </div>

            {/* Arquiteto */}
            <div>
              <Label>Arquiteto</Label>
              <Select value={clienteForm.arquiteto_id || "none"} onValueChange={(v) => setClienteForm({ ...clienteForm, arquiteto_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— Nenhum —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {arqs.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              const hasData = Object.values(clienteForm).some(v => typeof v === "string" && v.trim() !== "");
              if (hasData) { setClienteUnsavedDlg(true); } else { setClienteDlg(false); }
            }}>Cancelar</Button>
            <Button onClick={saveCliente} disabled={savingCliente}>
              {savingCliente && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar e selecionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rodapé fixo ─────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 md:left-64 z-20 bg-background border-t border-border px-4 pt-3 flex justify-end gap-2 flex-wrap"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
        {!isNew && orcamentoId && (
          <Button variant="outline" onClick={() => setVisualizarAvisoDlg(true)} disabled={visualizandoPdf}>
            {visualizandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Visualizar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        )}
        <Button onClick={() => save(true)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          <span className="hidden sm:inline">Salvar e abrir PDF</span>
          <span className="sm:hidden">Salvar+PDF</span>
        </Button>
      </div>

      {/* Dialog: ordem dos grupos no PDF */}
      <Dialog open={pdfOrderDlg} onOpenChange={(o) => { if (!o) setPdfOrderDlg(false); }}>
        <DialogContent className="max-w-md p-0 flex flex-col gap-0">
          {pdfOrderStep === "choice" && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                <DialogTitle>Gerar PDF</DialogTitle>
                <DialogDescription>Como deseja ordenar os grupos de itens no PDF?</DialogDescription>
              </DialogHeader>
              <div className="px-5 py-5 flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => pdfPreviewModeRef.current ? gerarPreviewComGrupos([]) : navigateToPdf([])}
                >
                  <FileText className="h-5 w-5 mr-3 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold">Usar ordem padrão</p>
                    <p className="text-xs font-normal opacity-75">Segmento → Ambiente, conforme cadastro</p>
                  </div>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => setPdfOrderStep("reorder")}
                >
                  <ChevronsUpDown className="h-5 w-5 mr-3 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold">Personalizar ordem</p>
                    <p className="text-xs font-normal text-muted-foreground">Arraste ou use as setas para reordenar os blocos</p>
                  </div>
                </Button>
              </div>
              <DialogFooter className="px-5 pb-4">
                <Button variant="ghost" size="sm" onClick={() => setPdfOrderDlg(false)}>Cancelar</Button>
              </DialogFooter>
            </>
          )}
          {pdfOrderStep === "reorder" && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                <Button type="button" variant="ghost" size="sm" className="-ml-1 mb-1 h-7 px-2 text-xs" onClick={() => setPdfOrderStep("choice")}>
                  ← Voltar
                </Button>
                <DialogTitle>Personalizar ordem</DialogTitle>
                <DialogDescription>Use as setas para definir a ordem dos blocos no PDF.</DialogDescription>
              </DialogHeader>
              <div className="px-5 py-4 space-y-2 overflow-y-auto max-h-[60vh]">
                {pdfGrupos.map((g, i) => (
                  <div key={`${g.seg}|||${g.amb}`} className="flex items-center gap-2 p-2.5 border border-border rounded-lg bg-card">
                    <span className="flex-1 text-sm min-w-0">
                      <span className="font-medium">{g.seg}</span>
                      <span className="text-muted-foreground"> — {g.amb}</span>
                    </span>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => movePdfGrupo(i, -1)}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={i === pdfGrupos.length - 1}
                        onClick={() => movePdfGrupo(i, 1)}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="px-5 py-3 border-t border-border">
                <Button variant="outline" onClick={() => setPdfOrderDlg(false)}>Cancelar</Button>
                <Button onClick={() => pdfPreviewModeRef.current ? gerarPreviewComGrupos(pdfGrupos) : navigateToPdf(pdfGrupos)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {pdfPreviewModeRef.current ? "Visualizar PDF" : "Gerar PDF"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: selecionar e configurar kit — 2 etapas */}
      <Dialog open={kitDlg} onOpenChange={(o) => { if (!o) { setKitDlg(false); setKitStep("list"); setKitSelecionadoRaw(null); setKitSelecoes({}); setKitBuscas({}); setKitFocused({}); setKitProdsDisponiveis({}); setKitClosedProds([]); setKitContexto({ segmento_id: null, ambiente_id: null }); } }}>
        <DialogContent className="max-w-lg p-0 flex flex-col gap-0 h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh] rounded-none sm:rounded-lg">

          {/* ── Etapa 1: lista de kits ── */}
          {kitStep === "list" && (() => {
            const kitsToShow = dbKits || [];
            const cats = [...new Set(kitsToShow.map((k: any) => k.categoria || "Kits"))].filter(Boolean);
            return (
              <>
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
                  <DialogTitle>Selecionar kit</DialogTitle>
                  <DialogDescription>Clique no kit para configurar os produtos de cada slot.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
                  {cats.map(cat => (
                    <div key={cat}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
                      <div className="space-y-2">
                        {kitsToShow.filter((k: any) => (k.categoria || "Kits") === cat).map((kit: any) => {
                          const composicao = [...(kit.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem).map((it: any) => `${it.quantidade}x ${it.descricao}`).join(" + ");
                          return (
                            <button key={kit.id} type="button"
                              className="w-full text-left border border-border rounded-lg p-3 hover:bg-accent transition-colors"
                              onClick={() => onSelectKit(kit)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{kit.nome}</span>
                                {kit.tipo === "fechado" && (
                                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">🔒</span>
                                )}
                              </div>
                              {composicao && <div className="text-xs text-muted-foreground mt-0.5">{composicao}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {kitsToShow.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum kit disponível. Cadastre kits na tela de Kits.</p>
                  )}
                </div>
                <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setKitDlg(false)}>Cancelar</Button>
                </DialogFooter>
              </>
            );
          })()}

          {/* ── Etapa 2b: kit fechado — confirmar itens fixos ── */}
          {kitStep === "confirm_closed" && (() => {
            const slots = [...(kitSelecionadoRaw?.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
            const totalKit = slots.reduce((sum: number, slot: any) => {
              const prod = kitClosedProds.find((p: any) => p.sku === slot.produto_codigo);
              return sum + slot.quantidade * (Number(prod?.msrp) || 0);
            }, 0);
            return (
              <>
                <DialogHeader className="px-4 pt-3 pb-3 border-b border-border shrink-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="ghost" size="sm" className="-ml-1 h-7 px-2 text-xs"
                      onClick={() => { setKitStep("list"); setKitSelecionadoRaw(null); setKitClosedProds([]); }}>
                      ← Voltar
                    </Button>
                    <DialogTitle className="flex-1 text-base">🔒 {kitSelecionadoRaw?.nome}</DialogTitle>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setKitDlg(false)}>Cancelar</Button>
                    <Button size="sm" onClick={confirmClosedKit} disabled={kitProdsLoading}>
                      Adicionar ao orçamento
                    </Button>
                  </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destino dos itens</p>
                    <div>
                      <Label className="text-xs mb-1 block">Ambiente</Label>
                      <Select value={kitContexto.ambiente_id || ""} onValueChange={(v) => setKitContexto(prev => ({ ...prev, ambiente_id: v || null }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {ambientes.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {kitProdsLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                    </div>
                  ) : (
                    <>
                      {slots.map((slot: any) => {
                        const prod = kitClosedProds.find((p: any) => p.sku === slot.produto_codigo);
                        const precoUn = Number(prod?.msrp) || 0;
                        const total = slot.quantidade * precoUn;
                        return (
                          <div key={slot.id} className="border border-border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-tight">{prod?.nome_fantasia || prod?.titulo || slot.descricao}</p>
                                {slot.produto_codigo && <p className="text-xs text-muted-foreground mt-0.5">{slot.produto_codigo}</p>}
                              </div>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">×{slot.quantidade}</span>
                            </div>
                            {precoUn > 0 ? (
                              <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
                                <span className="text-xs text-muted-foreground">{brl(precoUn)} × {slot.quantidade}</span>
                                <span className="text-sm font-semibold">{brl(total)}</span>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1 italic">Sem preço cadastrado — será R$ 0,00</p>
                            )}
                          </div>
                        );
                      })}
                      {totalKit > 0 && (
                        <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
                          <span className="text-sm font-semibold text-muted-foreground">Total do kit</span>
                          <span className="text-base font-bold">{brl(totalKit)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── Etapa 2: configurar produtos por slot ── */}
          {kitStep === "configure" && (() => {
            const slots = [...(kitSelecionadoRaw?.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
            const requiredSlots = slots.filter((s: any) => !!s.categoria_produto);
            const allRequiredFilled = requiredSlots.every((s: any) => !!kitSelecoes[s.id]);
            const hasNoProdsSlots = requiredSlots.some((s: any) => (kitProdsDisponiveis[s.categoria_produto] || []).length === 0);
            return (
              <>
                <DialogHeader className="px-4 pt-3 pb-3 border-b border-border shrink-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="ghost" size="sm" className="-ml-1 h-7 px-2 text-xs"
                      onClick={() => { setKitStep("list"); setKitSelecionadoRaw(null); setKitSelecoes({}); setKitBuscas({}); setKitFocused({}); setKitProdsDisponiveis({}); }}>
                      ← Voltar
                    </Button>
                    <DialogTitle className="flex-1 text-base">{kitSelecionadoRaw?.nome}</DialogTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasNoProdsSlots && (
                      <p className="text-xs text-destructive flex-1">Alguns slots não têm produtos disponíveis.</p>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button size="sm" variant="outline" onClick={() => setKitDlg(false)}>Cancelar</Button>
                      <Button size="sm" onClick={confirmKit} disabled={!allRequiredFilled || hasNoProdsSlots || kitProdsLoading}>
                        Confirmar kit
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destino dos itens</p>
                    <div>
                      <Label className="text-xs mb-1 block">Ambiente</Label>
                      <Select value={kitContexto.ambiente_id || ""} onValueChange={(v) => setKitContexto(prev => ({ ...prev, ambiente_id: v || null }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {ambientes.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {kitProdsLoading && (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                    </div>
                  )}
                  {!kitProdsLoading && slots.map((slot: any) => {
                    const prods = slot.categoria_produto ? (kitProdsDisponiveis[slot.categoria_produto] || []) : [];
                    const semCategoria = !slot.categoria_produto;
                    const semProdutos = !semCategoria && prods.length === 0;
                    return (
                      <div key={slot.id} className="border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-sm">{slot.descricao}</span>
                            <span className="ml-2 text-xs text-muted-foreground">×{slot.quantidade}</span>
                          </div>
                        </div>
                        {semCategoria && (
                          <p className="text-xs text-muted-foreground italic">Sem categoria configurada — configure na tela de Kits.</p>
                        )}
                        {semProdutos && (
                          <p className="text-xs text-destructive">Nenhum produto em "{slot.categoria_produto}".</p>
                        )}
                        {!semCategoria && !semProdutos && (() => {
                          const selectedId = kitSelecoes[slot.id];
                          const selectedProd = selectedId ? prods.find((p: any) => p.id === selectedId) : null;
                          const isFocused = kitFocused[slot.id] || false;
                          const busca = kitBuscas[slot.id] || "";
                          const inputValue = isFocused ? busca : (selectedProd ? (selectedProd.nome_fantasia || selectedProd.titulo) : "");
                          const s = busca.toLowerCase().trim();
                          const SINONIMOS_BYPASS = ["receiver", "receptor", "receptores"];
                          const isSinonimo = s.length >= 3 && SINONIMOS_BYPASS.some(sin => sin.startsWith(s) || s.startsWith(sin));
                          const filtrados = (s && !isSinonimo)
                            ? prods.filter((p: any) =>
                                (p.nome_fantasia || p.titulo || "").toLowerCase().includes(s) ||
                                (p.titulo || "").toLowerCase().includes(s) ||
                                (p.sku || "").toLowerCase().includes(s) ||
                                (p.modelo || "").toLowerCase().includes(s)
                              )
                            : prods;
                          const showDropdown = isFocused && (s !== "" || prods.length <= 8 || !selectedProd);
                          return (
                            <div className="space-y-1">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                  type="text"
                                  className={`h-9 w-full rounded-md border border-input pl-8 ${selectedProd ? "pr-8 bg-muted/40" : "pr-3 bg-background"} text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring`}
                                  placeholder={prods.length > 8 ? `Buscar entre ${prods.length} produtos...` : "Buscar produto..."}
                                  value={inputValue}
                                  onChange={(e) => setKitBuscas(prev => ({ ...prev, [slot.id]: e.target.value }))}
                                  onFocus={() => {
                                    setKitFocused(prev => ({ ...prev, [slot.id]: true }));
                                    setKitBuscas(prev => ({ ...prev, [slot.id]: "" }));
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setKitFocused(prev => ({ ...prev, [slot.id]: false }));
                                      setKitBuscas(prev => ({ ...prev, [slot.id]: "" }));
                                    }, 150);
                                  }}
                                />
                                {selectedProd && (
                                  <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setKitSelecoes(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
                                      setKitBuscas(prev => ({ ...prev, [slot.id]: "" }));
                                      setKitFocused(prev => ({ ...prev, [slot.id]: false }));
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {selectedProd && !isFocused && (
                                <p className="text-xs text-muted-foreground px-1">
                                  {brl(Number(selectedProd.msrp))} / un.
                                  {slot.quantidade > 1 && (
                                    <span className="ml-2 font-medium text-foreground">
                                      = {brl(slot.quantidade * Number(selectedProd.msrp))} total
                                    </span>
                                  )}
                                </p>
                              )}
                              {showDropdown && (
                                <div className="max-h-36 overflow-y-auto border border-border rounded-md bg-background text-sm divide-y divide-border/50">
                                  {filtrados.length > 0 ? filtrados.map((p: any) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center justify-between gap-2"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setKitSelecoes(prev => ({ ...prev, [slot.id]: p.id }));
                                        setKitBuscas(prev => ({ ...prev, [slot.id]: "" }));
                                        setKitFocused(prev => ({ ...prev, [slot.id]: false }));
                                      }}
                                    >
                                      <span className="truncate">{p.nome_fantasia || p.titulo}</span>
                                      {p.msrp && (
                                        <span className="text-xs text-muted-foreground shrink-0">
                                          R$ {Number(p.msrp).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </button>
                                  )) : (
                                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

        </DialogContent>
      </Dialog>

      {/* Dialog: produto duplicado */}
      <Dialog open={!!dupDlg?.open} onOpenChange={(o) => { if (!o) setDupDlg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produto já adicionado</DialogTitle>
            <DialogDescription>
              <strong>{dupDlg?.produto?.titulo}</strong> já está na lista. Deseja adicionar novamente mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupDlg(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (dupDlg) { applyProduto(dupDlg.idx, dupDlg.produto); setDupDlg(null); }
            }}>Adicionar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: novo ambiente */}
      <Dialog open={ambDlg.open} onOpenChange={(o) => setAmbDlg({ open: o, itemIdx: o ? ambDlg.itemIdx : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo ambiente</DialogTitle>
            <DialogDescription>Ex.: Sala, Cozinha, Escritório.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome *</Label>
            <Input autoFocus value={ambNome} onChange={(e) => setAmbNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAmbiente()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmbDlg({ open: false, itemIdx: null })}>Cancelar</Button>
            <Button onClick={saveAmbiente}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug #7 — Confirmação: sair sem salvar o orçamento */}
      <Dialog open={unsavedDlg} onOpenChange={setUnsavedDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              Você tem alterações não salvas. Se sair agora, os dados serão perdidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="w-full sm:w-auto" onClick={() => setUnsavedDlg(false)}>
              Continuar editando
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setUnsavedDlg(false); nav({ to: "/orcamentos" }); }}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug #7 — Confirmação: fechar modal de novo cliente com dados preenchidos */}
      <Dialog open={clienteUnsavedDlg} onOpenChange={setClienteUnsavedDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descartar dados do cliente?</DialogTitle>
            <DialogDescription>
              Os dados preenchidos serão perdidos. Deseja realmente fechar sem cadastrar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="w-full sm:w-auto" onClick={() => setClienteUnsavedDlg(false)}>
              Continuar preenchendo
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
              setClienteUnsavedDlg(false);
              setClienteDlg(false);
              setClienteForm({ nome_razao_social: "", cpf_cnpj: "", telefone: "", celular: "", email: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "", endereco_instalacao: "", arquiteto_id: "" });
              setClienteEmailErr(false);
              setClienteCepErr("");
            }}>
              Fechar e descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: itens sem produto ao gerar PDF */}
      <Dialog open={emptyItemsDlg} onOpenChange={setEmptyItemsDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Itens sem produto</DialogTitle>
            <DialogDescription>
              Existem itens sem produto selecionado. Deseja removê-los antes de gerar o PDF?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEmptyItemsDlg(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" onClick={confirmRemoveEmpty}>
              Sim, remover e gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
