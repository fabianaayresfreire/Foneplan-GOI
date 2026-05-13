import { useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2, Save, FileText, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { brl, STATUS_LABELS, TIPO_ITEM_LABELS } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { ProdutoCombobox } from "@/components/ProdutoCombobox";
import { CurrencyInput } from "@/components/CurrencyInput";

type Item = {
  id?: string;
  segmento_id: string | null;
  ambiente_id: string | null;
  produto_id: string | null;
  produto_titulo: string;
  produto_sku?: string | null;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  desconto_item: number;
  valor_total: number;
  tipo_item: string;
  observacao?: string | null;
  ordem_exibicao: number;
};

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

const ADD_NEW = "__add_new__";

export default function OrcamentoEditor({ orcamentoId }: { orcamentoId?: string }) {
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const isNew = !orcamentoId;

  const [clientes, setClientes] = useState<any[]>([]);
  const [segmentos, setSegmentos] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  // produto labels cache for combobox display
  const [produtoLabels, setProdutoLabels] = useState<Record<string, string>>({});

  const [form, setForm] = useState<any>({
    cliente_id: "",
    nome_projeto: "",
    tipo_projeto: "residencial",
    status: "rascunho",
    observacoes_internas: "",
    observacoes_cliente: "",
    prazo: "",
    garantia: "",
    desconto: 0,
  });

  const [itens, setItens] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Dialog states
  const [clienteDlg, setClienteDlg] = useState(false);
  const [arqs, setArqs] = useState<any[]>([]);
  const [clienteForm, setClienteForm] = useState({ nome_razao_social: "", cpf_cnpj: "", telefone: "", email: "", endereco: "", arquiteto_id: "" });
  const [savingCliente, setSavingCliente] = useState(false);

  const [segDlg, setSegDlg] = useState<{ open: boolean; itemIdx: number | null }>({ open: false, itemIdx: null });
  const [segNome, setSegNome] = useState("");
  const [ambDlg, setAmbDlg] = useState<{ open: boolean; itemIdx: number | null }>({ open: false, itemIdx: null });
  const [ambNome, setAmbNome] = useState("");

  useEffect(() => {
    (async () => {
      const [c, s, a, arq] = await Promise.all([
        supabase.from("clientes").select("id,nome_razao_social,numero_cliente").order("nome_razao_social"),
        supabase.from("segmentos").select("*").eq("status", true).order("ordem"),
        supabase.from("ambientes").select("*").eq("status", true).order("ordem"),
        supabase.from("arquitetos").select("id,nome").eq("status", true).order("nome"),
      ]);
      setClientes(c.data || []);
      setSegmentos(s.data || []);
      setAmbientes(a.data || []);
      setArqs(arq.data || []);

      if (orcamentoId) {
        const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).single();
        if (orc) {
          setForm({
            cliente_id: orc.cliente_id,
            nome_projeto: orc.nome_projeto,
            tipo_projeto: orc.tipo_projeto,
            status: orc.status,
            observacoes_internas: orc.observacoes_internas || "",
            observacoes_cliente: orc.observacoes_cliente || "",
            prazo: orc.prazo || "",
            garantia: orc.garantia || "",
            desconto: Number(orc.desconto) || 0,
          });
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
        const labels: Record<string, string> = {};
        list.forEach((it: any) => { if (it.produto_id) labels[it.produto_id] = it.produto_titulo; });
        setProdutoLabels(labels);
      }
      setLoading(false);
    })();
  }, [orcamentoId]);

  const valorBruto = useMemo(
    () => itens.filter(i => ["venda_normal", "cliente"].includes(i.tipo_item)).reduce((s, i) => s + computeTotal(i), 0),
    [itens]
  );
  const valorFinal = Math.max(0, valorBruto - (Number(form.desconto) || 0));

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItens(arr => arr.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.valor_total = computeTotal(merged);
      return merged;
    }));
  };

  const addItem = () => setItens(arr => [...arr, blankItem(arr.length)]);
  const removeItem = (idx: number) => setItens(arr => arr.filter((_, i) => i !== idx));

  const onPickProduto = (idx: number, p: any) => {
    updateItem(idx, {
      produto_id: p.id,
      produto_titulo: p.titulo,
      produto_sku: p.sku,
      unidade: p.unidade || "un",
      preco_unitario: Number(p.msrp) || 0,
    });
    setProdutoLabels(prev => ({ ...prev, [p.id]: p.titulo }));
  };

  const saveCliente = async () => {
    if (!clienteForm.nome_razao_social.trim()) return toast.error("Informe o nome do cliente.");
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
    setClienteForm({ nome_razao_social: "", cpf_cnpj: "", telefone: "", email: "", endereco: "", arquiteto_id: "" });
    setClienteDlg(false);
    toast.success(`Cliente #${data.numero_cliente} cadastrado`);
  };

  const saveSegmento = async () => {
    if (!segNome.trim()) return toast.error("Informe o nome do segmento.");
    const { data, error } = await supabase.from("segmentos").insert({ nome: segNome.trim(), ordem: segmentos.length }).select().single();
    if (error) return toast.error(error.message);
    setSegmentos(arr => [...arr, data]);
    if (segDlg.itemIdx !== null) updateItem(segDlg.itemIdx, { segmento_id: data.id });
    setSegNome("");
    setSegDlg({ open: false, itemIdx: null });
    toast.success("Segmento criado");
  };

  const saveAmbiente = async () => {
    if (!ambNome.trim()) return toast.error("Informe o nome do ambiente.");
    const { data, error } = await supabase.from("ambientes").insert({ nome: ambNome.trim(), ordem: ambientes.length }).select().single();
    if (error) return toast.error(error.message);
    setAmbientes(arr => [...arr, data]);
    if (ambDlg.itemIdx !== null) updateItem(ambDlg.itemIdx, { ambiente_id: data.id });
    setAmbNome("");
    setAmbDlg({ open: false, itemIdx: null });
    toast.success("Ambiente criado");
  };

  const save = async (goPdf = false) => {
    const errs: Record<string, boolean> = {};
    if (!form.cliente_id) errs.cliente_id = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Preencha os campos destacados em vermelho.");
    setSaving(true);

    const payload = {
      ...form,
      desconto: Number(form.desconto) || 0,
      valor_bruto: valorBruto,
      valor_final: valorFinal,
      vendedor_id: user!.id,
    };

    let id = orcamentoId;
    let numero: number | undefined;
    if (isNew) {
      const { data, error } = await supabase.from("orcamentos").insert(payload).select().single();
      if (error) { setSaving(false); return toast.error(error.message); }
      id = data.id;
      numero = data.numero_orcamento;
    } else {
      const { error } = await supabase.from("orcamentos").update(payload).eq("id", orcamentoId!);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("orcamento_itens").delete().eq("orcamento_id", orcamentoId!);
    }

    if (itens.length) {
      const insertable = itens.map((it, i) => ({
        orcamento_id: id!,
        segmento_id: it.segmento_id,
        ambiente_id: it.ambiente_id,
        produto_id: it.produto_id,
        produto_titulo: it.produto_titulo || "Item",
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
    toast.success(numero ? `Orçamento #${numero} salvo` : "Orçamento salvo");
    if (goPdf) nav({ to: "/orcamentos/$id/pdf", params: { id: id! }, search: { download: "1" } });
    else if (isNew) nav({ to: "/orcamentos/$id", params: { id: id! } });
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link to="/orcamentos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {isNew ? "Novo orçamento" : "Editar orçamento"}
          </h1>
        </div>
        <div className="flex gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button className="flex-1 sm:flex-initial" onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Salvar e gerar PDF</span>
            <span className="sm:hidden">PDF</span>
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
              <Button type="button" variant="outline" onClick={() => setClienteDlg(true)} title="Cadastrar novo cliente">
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
          <div className="md:col-span-3 grid md:grid-cols-2 gap-4">
            <div>
              <Label>Observações ao cliente (PDF)</Label>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Itens do orçamento</h2>
          <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-2" /> Adicionar item</Button>
        </div>

        {/* ── Mobile: cards empilhados ── */}
        <div className="flex flex-col gap-3 md:hidden">
          {itens.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item ainda. Clique em "Adicionar item".</p>
          )}
          {itens.map((it, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-card">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Segmento</Label>
                <Select value={it.segmento_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setSegDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { segmento_id: v }); }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {segmentos.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum segmento. Peça ao admin.</div>}
                    {segmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    {isAdmin && <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo segmento</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ambiente</Label>
                <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v }); }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {ambientes.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum ambiente. Peça ao admin.</div>}
                    {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    {isAdmin && <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Produto</Label>
                <ProdutoCombobox value={it.produto_id} selectedLabel={it.produto_id ? (produtoLabels[it.produto_id] || it.produto_titulo) : null} onSelect={(p) => onPickProduto(idx, p)} />
                <Input className="mt-1 h-8 text-xs" placeholder="Observação (opcional)" value={it.observacao || ""} onChange={(e) => updateItem(idx, { observacao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Tipo</Label>
                  <Select value={it.tipo_item} onValueChange={(v) => updateItem(idx, { tipo_item: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_ITEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Quantidade</Label>
                  <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Preço un.</Label>
                  <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Desconto</Label>
                  <CurrencyInput value={it.desconto_item} onChange={(v) => updateItem(idx, { desconto_item: v })} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Total</Label>
                  <p className="font-semibold text-right pt-2 text-sm">{brl(it.valor_total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop: tabela horizontal ── */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Segmento</TableHead>
                <TableHead className="w-[160px]">Ambiente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[130px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Qtd</TableHead>
                <TableHead className="w-[120px]">Preço un.</TableHead>
                <TableHead className="w-[110px]">Desc.</TableHead>
                <TableHead className="w-[120px] text-right">Total</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum item ainda. Clique em "Adicionar item".</TableCell></TableRow>
              )}
              {itens.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Select value={it.segmento_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setSegDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { segmento_id: v }); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {segmentos.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum segmento. Peça ao admin.</div>}
                        {segmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                        {isAdmin && <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo segmento</SelectItem>}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={it.ambiente_id || ""} onValueChange={(v) => { if (v === ADD_NEW) { setAmbDlg({ open: true, itemIdx: idx }); return; } updateItem(idx, { ambiente_id: v }); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {ambientes.length === 0 && !isAdmin && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum ambiente. Peça ao admin.</div>}
                        {ambientes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        {isAdmin && <SelectItem value={ADD_NEW} className="text-primary font-medium">+ Novo ambiente</SelectItem>}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <ProdutoCombobox value={it.produto_id} selectedLabel={it.produto_id ? (produtoLabels[it.produto_id] || it.produto_titulo) : null} onSelect={(p) => onPickProduto(idx, p)} />
                    <Input className="mt-1 h-8 text-xs" placeholder="Observação (opcional)" value={it.observacao || ""} onChange={(e) => updateItem(idx, { observacao: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Select value={it.tipo_item} onValueChange={(v) => updateItem(idx, { tipo_item: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_ITEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="1" min="1" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </TableCell>
                  <TableCell>
                    <CurrencyInput value={it.preco_unitario} onChange={(v) => updateItem(idx, { preco_unitario: v })} />
                  </TableCell>
                  <TableCell>
                    <CurrencyInput value={it.desconto_item} onChange={(v) => updateItem(idx, { desconto_item: v })} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{brl(it.valor_total)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor bruto</span>
              <span>{brl(valorBruto)}</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm text-muted-foreground">Desconto geral</span>
              <CurrencyInput className="w-32 text-right" value={Number(form.desconto) || 0}
                onChange={(v) => setForm({ ...form, desconto: v })} />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Valor final</span>
              <span className="text-primary">{brl(valorFinal)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Dialog: novo cliente */}
      <Dialog open={clienteDlg} onOpenChange={setClienteDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre rapidamente. Você pode completar os dados depois em Clientes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome / Razão social *</Label>
              <Input value={clienteForm.nome_razao_social} onChange={(e) => setClienteForm({ ...clienteForm, nome_razao_social: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF / CNPJ</Label>
                <Input value={clienteForm.cpf_cnpj} onChange={(e) => setClienteForm({ ...clienteForm, cpf_cnpj: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={clienteForm.endereco} onChange={(e) => setClienteForm({ ...clienteForm, endereco: e.target.value })} />
            </div>
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
            <Button variant="outline" onClick={() => setClienteDlg(false)}>Cancelar</Button>
            <Button onClick={saveCliente} disabled={savingCliente}>
              {savingCliente && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar e selecionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: novo segmento */}
      <Dialog open={segDlg.open} onOpenChange={(o) => setSegDlg({ open: o, itemIdx: o ? segDlg.itemIdx : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo segmento</DialogTitle>
            <DialogDescription>Categorias de itens (ex.: Áudio, Vídeo, Automação).</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome *</Label>
            <Input autoFocus value={segNome} onChange={(e) => setSegNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveSegmento()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegDlg({ open: false, itemIdx: null })}>Cancelar</Button>
            <Button onClick={saveSegmento}>Cadastrar</Button>
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
    </div>
  );
}
