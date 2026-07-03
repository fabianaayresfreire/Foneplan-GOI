import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Search, Upload, Download, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: Page,
});

const empty = { sku: "", titulo: "", nome_fantasia: "", marca: "", modelo: "", categoria: "", msrp: 0, unidade: "un", status: true };

type ParsedRow = {
  sku: string | null;
  titulo: string;
  nome_fantasia: string | null;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  unidade: string;
  msrp: number;
  status: boolean;
};

const parseNumberBR = (v: any): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/[^\d,.\-]/g, "");
  // BR format: 1.234,56  → 1234.56
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(s.replace(/,/g, "")) || 0;
};

const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const COL_MAP: Record<string, keyof ParsedRow> = {
  sku: "sku", codigo: "sku", code: "sku",
  titulo: "titulo", title: "titulo", nome: "titulo", produto: "titulo", descricao: "titulo",
  nomefantasia: "nome_fantasia", fantasia: "nome_fantasia", apelido: "nome_fantasia",
  marca: "marca", brand: "marca",
  modelo: "modelo", model: "modelo",
  categoria: "categoria", category: "categoria",
  segmento: "categoria", segmentocategoria: "categoria", segcat: "categoria",
  unidade: "unidade", un: "unidade", unit: "unidade",
  msrp: "msrp", preco: "msrp", precounitario: "msrp", valor: "msrp", price: "msrp",
};

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterModelo, setFilterModelo] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; nome: string } | null>(null);

  // ── Paginação ────────────────────────────────────────────────────────────────
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [updateBySku, setUpdateBySku] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const PAGE = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("categoria", { ascending: true, nullsFirst: false })
        .order("titulo")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRows(all);
  };
  useEffect(() => { load(); }, []);

  // Listas em cascata derivadas dos dados já carregados
  const allMarcas = useMemo(() =>
    [...new Set(rows.map((r: any) => r.marca).filter(Boolean))].sort() as string[],
  [rows]);

  const allModelos = useMemo(() => {
    const base = filterMarca ? rows.filter((r: any) => r.marca === filterMarca) : rows;
    return [...new Set(base.map((r: any) => r.modelo).filter(Boolean))].sort() as string[];
  }, [rows, filterMarca]);

  // Ao trocar marca, limpa modelo e volta para página 1
  useEffect(() => { setFilterModelo(""); setPage(1); }, [filterMarca]);

  // Reseta para página 1 sempre que qualquer filtro mudar
  useEffect(() => { setPage(1); }, [search, filterMarca, filterModelo, filterCategoria]);

  const save = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nome_fantasia: _nf, ...rest } = form;
    const payload = { ...rest, msrp: Number(form.msrp) || 0, sku: form.sku?.trim() || null };
    if (edit) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("produtos").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); setOpen(false); load();
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    const { count } = await supabase.from("orcamento_itens").select("id", { count: "exact", head: true }).eq("produto_id", archiveTarget.id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: "${archiveTarget.nome}" está em ${count} item(ns) de orçamento. Produto arquivado (oculto em novos orçamentos).`);
      await supabase.from("produtos").update({ status: false }).eq("id", archiveTarget.id);
      setArchiveTarget(null);
      load();
      return;
    }
    const { error } = await supabase.from("produtos").delete().eq("id", archiveTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${archiveTarget.nome}" excluído`);
    setArchiveTarget(null);
    load();
  };

  const filtered = rows.filter(r => {
    const s = search.toLowerCase();
    if (s && !(
      r.titulo?.toLowerCase().includes(s) ||
      r.sku?.toLowerCase().includes(s) ||
      r.nome_fantasia?.toLowerCase().includes(s)
    )) return false;
    if (filterMarca && r.marca !== filterMarca) return false;
    if (filterModelo && r.modelo !== filterModelo) return false;
    if (filterCategoria && !r.categoria?.toLowerCase().includes(filterCategoria.toLowerCase())) return false;
    return true;
  });
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["codigo", "nome", "Nome Fantasia", "marca", "segmento", "preco"],
      ["FP-001", "Caixa Acústica de Embutir 6 Polegadas 30W RMS", "Caixa Slim 6\"", "Foneplan", "Áudio", "1250,00"],
      ["FP-002", "Amplificador Multi-Room 4 Canais 200W", "Amp MR-4", "Foneplan", "Áudio", "3499,90"],
      ["FP-003", "Módulo de Relê 8 Canais ON/OFF 12V", "Relê Smart 8ch", "Foneplan", "Automação", "890,00"],
      ["FP-004", "Painel de Controle Touch 7 Polegadas", "Touch Panel 7\"", "Foneplan", "Iluminação", "2100,00"],
    ]);
    // ajusta largura das colunas
    ws["!cols"] = [{ wch: 10 }, { wch: 45 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo-produtos.xlsx");
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const errs: string[] = [];
      const parsed: ParsedRow[] = [];

      json.forEach((raw, i) => {
        const row: any = {};
        for (const k of Object.keys(raw)) {
          const mapped = COL_MAP[norm(k)];
          if (mapped) row[mapped] = raw[k];
        }
        const titulo = String(row.titulo || "").trim();
        if (!titulo) {
          errs.push(`Linha ${i + 2}: sem título — ignorada`);
          return;
        }
        parsed.push({
          sku: row.sku ? String(row.sku).trim() : null,
          titulo,
          nome_fantasia: row.nome_fantasia ? String(row.nome_fantasia).trim() : null,
          marca: row.marca ? String(row.marca).trim() : null,
          modelo: row.modelo ? String(row.modelo).trim() : null,
          categoria: row.categoria ? String(row.categoria).trim() : null,
          unidade: row.unidade ? String(row.unidade).trim() : "un",
          msrp: parseNumberBR(row.msrp),
          status: true,
        });
      });

      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida encontrada na planilha");
        return;
      }
      setImportRows(parsed);
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
    let inserted = 0, updated = 0, failed = 0;

    // existing skus
    const skus = importRows.map(r => r.sku).filter(Boolean) as string[];
    let existingMap = new Map<string, string>();
    if (skus.length && updateBySku) {
      const { data } = await supabase.from("produtos").select("id,sku").in("sku", skus);
      (data || []).forEach((p: any) => p.sku && existingMap.set(p.sku, p.id));
    }

    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];
    importRows.forEach(r => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { nome_fantasia: _nf, ...data } = r; // strip until DB migration for nome_fantasia runs
      if (r.sku && existingMap.has(r.sku)) toUpdate.push({ id: existingMap.get(r.sku)!, data });
      else toInsert.push(data);
    });

    let firstError: string | null = null;

    // batch insert
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error, data: inserted_data } = await supabase.from("produtos").insert(chunk).select("id");
      if (error) {
        failed += chunk.length;
        if (!firstError) firstError = error.message;
      } else {
        inserted += inserted_data?.length ?? chunk.length;
      }
    }
    // updates one by one
    for (const u of toUpdate) {
      const { error } = await supabase.from("produtos").update(u.data).eq("id", u.id);
      if (error) { failed++; if (!firstError) firstError = error.message; }
      else updated++;
    }

    setImporting(false);
    setImportOpen(false);
    setImportRows([]);
    if (firstError && inserted === 0 && updated === 0) {
      toast.error(`Importação falhou: ${firstError}`);
    } else {
      toast.success(`Importação concluída: ${inserted} inserido${inserted !== 1 ? "s" : ""}, ${updated} atualizado${updated !== 1 ? "s" : ""}${failed ? ` — ${failed} com erro` : ""}`);
      if (firstError) toast.error(`Alguns registros falharam: ${firstError}`);
    }
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">Catálogo de produtos disponíveis nos orçamentos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />Baixar modelo
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importar planilha
          </Button>
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo produto
          </Button>
        </div>
      </div>

      <div className="sticky top-14 md:top-0 z-10 bg-background pb-3">
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome / SKU / nome fantasia..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select
              className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterMarca}
              onChange={(e) => setFilterMarca(e.target.value)}
            >
              <option value="">Marca</option>
              {allMarcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              value={filterModelo}
              onChange={(e) => setFilterModelo(e.target.value)}
              disabled={allModelos.length === 0}
            >
              <option value="">Modelo</option>
              {allModelos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input className="w-40" placeholder="Categoria" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} />
            {(search || filterMarca || filterModelo || filterCategoria) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSearch(""); setFilterMarca(""); setFilterModelo(""); setFilterCategoria(""); }}>
                Limpar
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Contador de resultados */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2 text-right">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Marca / Modelo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">MSRP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produto.</TableCell></TableRow>
            )}
            {(() => {
              // Agrupa por categoria mantendo a ordem já vinda do banco (categoria → titulo)
              const groups: { cat: string; items: typeof paginated }[] = [];
              paginated.forEach(r => {
                const cat = r.categoria || "Sem categoria";
                const last = groups[groups.length - 1];
                if (last && last.cat === cat) last.items.push(r);
                else groups.push({ cat, items: [r] });
              });
              return groups.flatMap(({ cat, items }) => [
                <TableRow key={`cat-${cat}`}>
                  <TableCell colSpan={7} className="bg-muted/60 py-1.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </TableCell>
                </TableRow>,
                ...items.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                    <TableCell className="font-medium">{r.titulo}</TableCell>
                    <TableCell>{[r.marca, r.modelo].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell>{r.categoria || "—"}</TableCell>
                    <TableCell className="text-right">{brl(r.msrp)}</TableCell>
                    <TableCell>{r.status ? <span className="text-green-600">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEdit(r); setForm({ ...empty, ...r }); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setArchiveTarget({ id: r.id, nome: r.titulo })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )),
              ]);
            })()}
          </TableBody>
        </Table>

        {/* ── Paginação ─────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 p-4 border-t border-border">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Próximo
            </Button>
          </div>
        )}
      </Card>

      {/* Dialog de confirmação de arquivo */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>"{archiveTarget?.nome}"</strong>?
              Se o produto estiver em orçamentos existentes, será arquivado (oculto) em vez de excluído permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doArchive}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div>
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={v => setForm({ ...form, unidade: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un — Unidade</SelectItem>
                  <SelectItem value="pr">pr — Par</SelectItem>
                  <SelectItem value="pç">pç — Peça</SelectItem>
                  <SelectItem value="m">m — Metro</SelectItem>
                  <SelectItem value="kt">kt — Kit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
            <div><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
            <div className="col-span-2"><Label>Nome Fantasia <span className="text-muted-foreground text-xs">(opcional — exibido no orçamento e no PDF)</span></Label><Input value={form.nome_fantasia} placeholder="Ex.: Módulo relê de 12 canais ON/OFF" onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div><Label>MSRP (R$)</Label><Input type="number" step="0.01" value={form.msrp} onChange={(e) => setForm({ ...form, msrp: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2"><Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} /><Label>Ativo (visível para novos orçamentos)</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar planilha de produtos</DialogTitle>
            <DialogDescription>
              Revise as {importRows.length} linhas detectadas antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          {importErrors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2 max-h-24 overflow-auto">
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="max-h-[360px] overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">MSRP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                    <TableCell>{r.titulo}</TableCell>
                    <TableCell>{r.marca || "—"}</TableCell>
                    <TableCell>{r.categoria || "—"}</TableCell>
                    <TableCell className="text-right">{brl(r.msrp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importRows.length > 50 && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                Mostrando 50 de {importRows.length} linhas...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Checkbox id="upd" checked={updateBySku} onCheckedChange={(v) => setUpdateBySku(!!v)} />
            <Label htmlFor="upd" className="cursor-pointer">Atualizar produtos existentes pelo SKU</Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? "Importando..." : `Confirmar (${importRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
