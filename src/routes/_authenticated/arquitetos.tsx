import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Search, Trash2 } from "lucide-react";
import { maskPhone } from "@/lib/masks";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/arquitetos")({ component: Page });

const empty = { nome: "", telefone: "", celular: "", email: "", empresa: "", observacoes: "", status: true };

type ArchiveTarget = { id: string; nome: string; linkedClientes: number } | null;

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("arquitetos").select("*").order("nome");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm(empty); setIsDirty(false); setOpen(true); };
  const openEdit = (a: any) => { setEdit(a); setForm({ ...empty, ...a }); setIsDirty(false); setOpen(true); };

  const handleFormChange = (patch: any) => {
    setForm((prev: any) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const requestClose = () => {
    if (isDirty) { setCloseConfirm(true); }
    else { setOpen(false); }
  };

  const confirmClose = () => { setCloseConfirm(false); setIsDirty(false); setOpen(false); };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    if (edit) {
      const { error } = await supabase.from("arquitetos").update(form).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("arquitetos").insert({ ...form, created_by: user!.id });
      if (error) return toast.error(error.message);
    }
    setIsDirty(false);
    toast.success("Salvo"); setOpen(false); load();
  };

  const handleArchiveClick = async (r: any) => {
    const { count } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("arquiteto_id", r.id);
    setArchiveTarget({ id: r.id, nome: r.nome, linkedClientes: count ?? 0 });
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    const { error } = await supabase.from("arquitetos").delete().eq("id", archiveTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${archiveTarget.nome}" excluído`);
    setArchiveTarget(null);
    load();
  };

  const filtered = rows.filter(r => !search || r.nome.toLowerCase().includes(search.toLowerCase()) || r.empresa?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Arquitetos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre arquitetos para vincular aos clientes.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo arquiteto</Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.empresa || "—"}</TableCell>
                <TableCell className="text-sm">{r.celular || r.telefone || r.email || "—"}</TableCell>
                <TableCell>{r.status ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleArchiveClick(r)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum arquiteto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de confirmação de arquivo */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir arquiteto</DialogTitle>
            <DialogDescription>
              {archiveTarget?.linkedClientes
                ? <>Este arquiteto está vinculado a <strong>{archiveTarget.linkedClientes} cliente{archiveTarget.linkedClientes !== 1 ? "s" : ""}</strong>. Deseja excluir mesmo assim? Os clientes vinculados perderão a referência ao arquiteto.</>
                : <>Tem certeza que deseja excluir <strong>"{archiveTarget?.nome}"</strong>? Esta ação é permanente.</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doArchive}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de saída sem salvar */}
      <Dialog open={closeConfirm} onOpenChange={(o) => { if (!o) setCloseConfirm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              Você tem alterações não salvas. Deseja sair sem salvar as alterações?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirm(false)}>Não, continuar editando</Button>
            <Button variant="destructive" onClick={confirmClose}>Sim, sair sem salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar arquiteto" : "Novo arquiteto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => handleFormChange({ nome: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => handleFormChange({ telefone: maskPhone(e.target.value) })} placeholder="(15) 3224-2316" maxLength={15} /></div>
            <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => handleFormChange({ celular: maskPhone(e.target.value) })} placeholder="(15) 99999-9999" maxLength={15} /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => handleFormChange({ email: e.target.value })} /></div>
            <div><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => handleFormChange({ empresa: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={(e) => handleFormChange({ observacoes: e.target.value })} /></div>
            <div className="md:col-span-2 flex items-center gap-2"><Switch checked={form.status} onCheckedChange={(v) => handleFormChange({ status: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={requestClose}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
