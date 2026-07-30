import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Archive, Upload, Download, X } from "lucide-react";
import { toast } from "sonner";
import { ProdutoCombobox, produtoLabel } from "@/components/ProdutoCombobox";

export const Route = createFileRoute("/_authenticated/kits")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: Page,
});

// ── Tipos e helpers ─────────────────────────────────────────────────────────
type KitItem = { descricao: string; produto_codigo: string; quantidade: number; categoria_produto: string; produto_id?: string | null; nome_fantasia?: string | null };
const emptyItem = (): KitItem => ({ descricao: "", produto_codigo: "", quantidade: 1, categoria_produto: "", produto_id: null });

const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const COL_MAP: Record<string, string> = {
  nomekit: "nome_kit",  nomkit: "nome_kit",  kit: "nome_kit",      nome: "nome_kit",
  produtocodigo: "produto_codigo",  codigo: "produto_codigo",  sku: "produto_codigo",
  produto: "produto_codigo",  descricao: "produto_codigo",  item: "produto_codigo",
  componente: "produto_codigo",
  quantidade: "quantidade",  qtd: "quantidade",  qty: "quantidade",  quant: "quantidade",
  categoria: "categoria",  cat: "categoria",  segmento: "categoria",
  categoriaproduto: "categoria_produto",  categoriaitem: "categoria_produto",
  categoriaprodutos: "categoria_produto",
};

// ── Componente principal ─────────────────────────────────────────────────────
function Page() {
  const [kits, setKits]                   = useState<any[]>([]);
  const [open, setOpen]                   = useState(false);
  const [edit, setEdit]                   = useState<any>(null);
  const [form, setForm]                   = useState({ nome: "", categoria: "", tipo: "aberto" as "aberto" | "fechado" });
  const [formItens, setFormItens]         = useState<KitItem[]>([emptyItem()]);
  const [saving, setSaving]               = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; nome: string } | null>(null);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen]     = useState(false);
  const [importGroups, setImportGroups] = useState<
    { nome: string; categoria: string; itens: { desc: string; cod: string; qtd: number; catProd: string }[] }[]
  >([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting]       = useState(false);

  // ── Carregamento ────────────────────────────────────────────────────────────
  const load = async () => {
    const [{ data: kitsData }, { data: prodsData }] = await Promise.all([
      supabase
        .from("kits")
        .select("id, nome, categoria, status, tipo, kit_itens(id, descricao, produto_codigo, produto_id, quantidade, ordem, categoria_produto)")
        .order("nome"),
      supabase.from("produtos").select("modelo").not("modelo", "is", null).eq("status", true),
    ]);
    setKits(kitsData || []);
    const cats = [...new Set((prodsData || []).map((p: any) => p.modelo as string).filter(Boolean))].sort();
    setCategoriasDisponiveis(cats);
  };
  useEffect(() => { load(); }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const composicao = (kit: any) =>
    (kit.kit_itens || [])
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((it: any) => `${it.quantidade}x ${it.descricao}`)
      .join(" + ") || "—";

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openNew = () => {
    setEdit(null);
    setForm({ nome: "", categoria: "", tipo: "aberto" });
    setFormItens([emptyItem()]);
    setOpen(true);
  };

  const openEdit = (kit: any) => {
    setEdit(kit);
    setForm({ nome: kit.nome, categoria: kit.categoria || "", tipo: kit.tipo || "aberto" });
    const sorted = [...(kit.kit_itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
    setFormItens(
      sorted.length > 0
        ? sorted.map((it: any) => ({
            descricao: it.descricao,
            produto_codigo: it.produto_codigo || "",
            quantidade: it.quantidade,
            categoria_produto: it.categoria_produto || "",
            produto_id: it.produto_id ?? null,
            nome_fantasia: it.nome_fantasia ?? null,
          }))
        : [emptyItem()]
    );
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome do kit obrigatório");
    const validItens = formItens.filter(i => i.descricao.trim());
    if (validItens.length === 0) return toast.error("Adicione pelo menos um item ao kit");
    setSaving(true);

    let kitId = edit?.id;
    if (edit) {
      const { error } = await supabase
        .from("kits")
        .update({ nome: form.nome.trim(), categoria: form.categoria.trim() || null, tipo: form.tipo })
        .eq("id", edit.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("kit_itens").delete().eq("kit_id", edit.id);
    } else {
      const { data, error } = await supabase
        .from("kits")
        .insert({ nome: form.nome.trim(), categoria: form.categoria.trim() || null, tipo: form.tipo })
        .select()
        .single();
      if (error) { setSaving(false); return toast.error(error.message); }
      kitId = data.id;
    }

    const { error: itemErr } = await supabase.from("kit_itens").insert(
      validItens.map((it, i) => ({
        kit_id: kitId,
        descricao: it.descricao.trim(),
        produto_codigo: it.produto_codigo.trim() || null,
        quantidade: it.quantidade,
        categoria_produto: it.categoria_produto.trim() || null,
        ordem: i,
      }))
    );
    if (itemErr) { setSaving(false); return toast.error(itemErr.message); }

    setSaving(false);
    toast.success(edit ? "Kit atualizado" : "Kit criado");
    setOpen(false);
    load();
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    const { error } = await supabase.from("kits").update({ status: false }).eq("id", archiveTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${archiveTarget.nome}" arquivado`);
    setArchiveTarget(null);
    load();
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome_kit", "produto_codigo", "quantidade", "categoria", "categoria_produto"],
      ["Kit 5.1", "Caixa de som", 5, "Áudio e Vídeo", "Caixa de som"],
      ["Kit 5.1", "Subwoofer", 1, "Áudio e Vídeo", "Subwoofer"],
      ["Kit 5.1", "Receptor A/V", 1, "Áudio e Vídeo", "Receiver"],
      ["Kit 7.1", "Caixa de som", 7, "Áudio e Vídeo", "Caixa de som"],
      ["Kit 7.1", "Subwoofer", 1, "Áudio e Vídeo", "Subwoofer"],
      ["Kit 7.1", "Receptor A/V", 1, "Áudio e Vídeo", "Receiver"],
      ["Automação 32 circ.", "Fonte", 1, "Automação", "Fonte"],
      ["Automação 32 circ.", "Módulo 12 canais relês", 2, "Automação", "Módulo RL12"],
      ["Automação 32 circ.", "Módulo 8 canais dimerizável", 1, "Automação", "Módulo DIM8"],
    ]);
    ws["!cols"] = [{ wch: 22 }, { wch: 32 }, { wch: 12 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kits");
    XLSX.writeFile(wb, "modelo-kits.xlsx");
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const errs: string[] = [];
      const groupMap = new Map<string, { categoria: string; itens: { desc: string; cod: string; qtd: number; catProd: string }[] }>();

      json.forEach((raw, i) => {
        const row: any = {};
        for (const k of Object.keys(raw)) {
          const mapped = COL_MAP[norm(k)];
          if (mapped) row[mapped] = raw[k];
        }
        const nome = String(row.nome_kit || "").trim();
        if (!nome) { errs.push(`Linha ${i + 2}: sem nome_kit — ignorada`); return; }
        const desc = String(row.produto_codigo || "").trim();
        if (!desc) { errs.push(`Linha ${i + 2}: sem produto/descrição — ignorada`); return; }
        const qtd = Math.max(1, Math.floor(Number(String(row.quantidade || 1).replace(",", ".")) || 1));
        const cat = String(row.categoria || "").trim();
        const catProd = String(row.categoria_produto || "").trim();

        if (!groupMap.has(nome)) groupMap.set(nome, { categoria: cat, itens: [] });
        const group = groupMap.get(nome)!;
        if (cat && !group.categoria) group.categoria = cat;
        group.itens.push({ desc, cod: desc, qtd, catProd });
      });

      if (groupMap.size === 0) { toast.error("Nenhum kit válido encontrado na planilha"); return; }

      setImportGroups(Array.from(groupMap.entries()).map(([nome, g]) => ({ nome, ...g })));
      setImportErrors(errs);
      setImportOpen(true);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    let created = 0, failed = 0, firstError: string | null = null;

    for (const group of importGroups) {
      const { data: kitData, error: kitErr } = await supabase
        .from("kits")
        .insert({ nome: group.nome, categoria: group.categoria || null })
        .select()
        .single();
      if (kitErr) { failed++; if (!firstError) firstError = kitErr.message; continue; }

      const { error: itemErr } = await supabase.from("kit_itens").insert(
        group.itens.map((it, i) => ({
          kit_id: kitData.id,
          descricao: it.desc,
          produto_codigo: it.cod || null,
          quantidade: it.qtd,
          categoria_produto: it.catProd || null,
          ordem: i,
        }))
      );
      if (itemErr) { failed++; firstError = firstError || itemErr.message; } else created++;
    }

    setImporting(false);
    setImportOpen(false);
    setImportGroups([]);

    if (firstError && created === 0) {
      toast.error(`Importação falhou: ${firstError}`);
    } else {
      toast.success(`${created} kit${created !== 1 ? "s" : ""} importado${created !== 1 ? "s" : ""}${failed ? ` — ${failed} com erro` : ""}`);
      if (firstError) toast.error(`Alguns kits falharam: ${firstError}`);
    }
    load();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kits</h1>
          <p className="text-sm text-muted-foreground mt-1">Kits disponíveis para os vendedores ao criar orçamentos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />Baixar modelo
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importar planilha
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />Novo kit
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-24">Modo</TableHead>
              <TableHead>Composição</TableHead>
              <TableHead className="w-20">Ativo</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kits.map(kit => (
              <TableRow key={kit.id}>
                <TableCell className="font-medium">{kit.nome}</TableCell>
                <TableCell>{kit.categoria || "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${kit.tipo === "fechado" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                    {kit.tipo === "fechado" ? "🔒 Fechado" : "🔓 Aberto"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-sm truncate">{composicao(kit)}</TableCell>
                <TableCell>
                  <Switch
                    checked={!!kit.status}
                    onCheckedChange={async (v) => {
                      await supabase.from("kits").update({ status: v }).eq("id", kit.id);
                      load();
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(kit)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setArchiveTarget({ id: kit.id, nome: kit.nome })}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {kits.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum kit cadastrado. Crie um ou importe uma planilha.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Dialog: criar / editar kit ───────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar kit" : "Novo kit"}</DialogTitle>
            <DialogDescription>Defina o nome, a categoria e os componentes do kit.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome do kit *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Kit 5.1"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex.: Áudio e Vídeo"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Modo do kit</Label>
              <div className="flex gap-2">
                <Button
                  type="button" size="sm"
                  variant={form.tipo === "aberto" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, tipo: "aberto" })}
                >
                  🔓 Aberto
                </Button>
                <Button
                  type="button" size="sm"
                  variant={form.tipo === "fechado" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, tipo: "fechado" })}
                >
                  🔒 Fechado
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {form.tipo === "fechado"
                  ? "Fechado: produtos fixos por SKU — vendedor apenas confirma a inclusão."
                  : "Aberto: vendedor escolhe o modelo de cada slot ao adicionar o kit."}
              </p>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens do kit</Label>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => setFormItens(arr => [...arr, emptyItem()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        {form.tipo === "fechado" ? "Produto *" : "Descrição *"}
                      </th>
                      {form.tipo === "aberto" && (
                        <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground w-36">Categoria do produto</th>
                      )}
                      {form.tipo === "aberto" && (
                        <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground w-28">Código (SKU)</th>
                      )}
                      <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground w-16">Qtd</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItens.map((it, idx) => (
                      <tr key={idx} className="border-t border-border/50">
                        <td className="px-3 py-2">
                          {form.tipo === "fechado" ? (
                            <div>
                              <ProdutoCombobox
                                value={it.produto_id ?? null}
                                selectedLabel={it.produto_id ? produtoLabel({ titulo: it.descricao, nome_fantasia: it.nome_fantasia ?? null, sku: it.produto_codigo || null }) : (it.produto_codigo || null)}
                                placeholder="Selecionar produto do catálogo..."
                                onSelect={(p) => setFormItens(arr =>
                                  arr.map((x, i) => i === idx ? {
                                    ...x,
                                    produto_id: p.id,
                                    descricao: p.titulo,
                                    produto_codigo: p.sku || "",
                                    nome_fantasia: p.nome_fantasia ?? null,
                                  } : x)
                                )}
                              />
                              {it.produto_codigo && (
                                <p className="text-[11px] text-muted-foreground mt-1 truncate">SKU: {it.produto_codigo}</p>
                              )}
                            </div>
                          ) : (
                            <Input
                              className="h-8 text-sm" value={it.descricao}
                              placeholder="Ex.: Caixa de som"
                              onChange={(e) => setFormItens(arr =>
                                arr.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x)
                              )}
                            />
                          )}
                        </td>
                        {form.tipo === "aberto" && (
                          <td className="px-2 py-2">
                            <select
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              value={it.categoria_produto}
                              onChange={(e) => setFormItens(arr =>
                                arr.map((x, i) => i === idx ? { ...x, categoria_produto: e.target.value } : x)
                              )}
                            >
                              <option value="">— nenhuma —</option>
                              {categoriasDisponiveis.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        {form.tipo === "aberto" && (
                          <td className="px-2 py-2">
                            <Input
                              className="h-8 text-sm" value={it.produto_codigo}
                              placeholder="FP-001"
                              onChange={(e) => setFormItens(arr =>
                                arr.map((x, i) => i === idx ? { ...x, produto_codigo: e.target.value } : x)
                              )}
                            />
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="1" step="1"
                            className="h-8 text-sm text-center w-14" value={it.quantidade}
                            onChange={(e) => setFormItens(arr =>
                              arr.map((x, i) => i === idx ? { ...x, quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)
                            )}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Button
                            type="button" size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => setFormItens(arr => arr.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {formItens.length === 0 && (
                      <tr>
                        <td colSpan={form.tipo === "aberto" ? 5 : 3} className="px-3 py-4 text-center text-sm text-muted-foreground">
                          Nenhum item. Clique em "Adicionar item".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: arquivo ─────────────────────────────────────────────────── */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar kit</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja arquivar <strong>"{archiveTarget?.nome}"</strong>?
              O kit não aparecerá mais para os vendedores, mas pode ser reativado a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doArchive}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: importação ──────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar kits</DialogTitle>
            <DialogDescription>
              {importGroups.length} kit{importGroups.length !== 1 ? "s" : ""} detectado{importGroups.length !== 1 ? "s" : ""}.
              Revise antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          {importErrors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2 max-h-24 overflow-auto">
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
            {importGroups.map((g, i) => (
              <div key={i} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{g.nome}</span>
                  {g.categoria && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{g.categoria}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {g.itens.map(it => `${it.qtd}x ${it.desc}`).join(" + ")}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? "Importando..." : `Importar ${importGroups.length} kit${importGroups.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
