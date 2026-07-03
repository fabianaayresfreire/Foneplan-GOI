import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/admin-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, UserPlus, Trash2 } from "lucide-react";
import { maskPhone } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: Page,
});

type EditTarget = { id: string; nome: string; email: string; celular: string } | null;
type InviteForm = { nome: string; email: string; senha: string; celular: string; role: "vendedor" | "admin" };
const emptyInvite: InviteForm = { nome: "", email: "", senha: "", celular: "", role: "vendedor" };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; nome: string } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInvite);
  const [inviting, setInviting] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; nome: string } | null>(null);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("nome");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, string[]>();
    roles?.forEach((r: any) => {
      const arr = map.get(r.user_id) || [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    });
    setRows((profiles || []).map((p: any) => ({ ...p, roles: map.get(p.id) || [] })));
  };
  useEffect(() => { load(); }, []);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
    }
    toast.success("Atualizado"); load();
  };

  const doEditProfile = async () => {
    if (!editTarget) return;
    if (!editTarget.nome.trim()) return toast.error("Nome obrigatório");
    if (!editTarget.email.trim()) return toast.error("E-mail obrigatório");
    const { error } = await supabase.from("profiles")
      .update({ nome: editTarget.nome.trim(), email: editTarget.email.trim(), celular: editTarget.celular || null })
      .eq("id", editTarget.id);
    if (error) { toast.error(error.message); return; }
    // Atualiza também o e-mail de login no auth
    await supabaseAdmin.auth.admin.updateUserById(editTarget.id, { email: editTarget.email.trim() });
    toast.success("Perfil atualizado");
    setEditTarget(null);
    load();
  };

  const doInvite = async () => {
    if (!inviteForm.nome.trim()) return toast.error("Informe o nome do usuário.");
    if (!inviteForm.email.trim()) return toast.error("Informe o e-mail.");
    if (inviteForm.senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    setInviting(true);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: inviteForm.email.trim(),
      password: inviteForm.senha,
      email_confirm: true,
      user_metadata: { nome: inviteForm.nome.trim() },
    });
    if (error) { setInviting(false); return toast.error(error.message); }
    if (inviteForm.role === "admin") {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
    }
    // Salva celular no profile se informado
    if (inviteForm.celular.trim()) {
      await supabase.from("profiles").update({ celular: inviteForm.celular.trim() }).eq("id", data.user.id);
    }
    setInviting(false);
    setInviteOpen(false);
    setInviteForm(emptyInvite);
    toast.success(`Usuário "${inviteForm.nome}" criado com sucesso!`);
    load();
  };

  const doDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const { count } = await supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("vendedor_id", deleteUserTarget.id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: "${deleteUserTarget.nome}" possui ${count} orçamento(s) vinculado(s).`);
      setDeleteUserTarget(null);
      return;
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(deleteUserTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Usuário "${deleteUserTarget.nome}" excluído.`);
    setDeleteUserTarget(null);
    load();
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", removeTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Acesso de "${removeTarget.nome}" removido`);
    setRemoveTarget(null);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários e papéis do sistema.</p>
        </div>
        <Button onClick={() => { setInviteForm(emptyInvite); setInviteOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-2" />Convidar usuário
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Celular</TableHead><TableHead>Papéis</TableHead><TableHead className="w-72 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => {
              const isAdmin = r.roles.includes("admin");
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.celular || "—"}</TableCell>
                  <TableCell>
                    {r.roles.map((rr: string) => (
                      <span key={rr} className={`mr-1 inline-block px-2 py-0.5 rounded text-xs font-semibold ${rr === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {rr}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditTarget({ id: r.id, nome: r.nome || "", email: r.email || "", celular: r.celular || "" })}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                      </Button>
                      <Button size="sm" variant={isAdmin ? "outline" : "default"} onClick={() => toggleAdmin(r.id, isAdmin)}>
                        {isAdmin ? "Remover admin" : "Tornar admin"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => setRemoveTarget({ id: r.id, nome: r.nome })}>
                        Remover acesso
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteUserTarget({ id: r.id, nome: r.nome })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {/* Diálogo editar perfil */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              Atualize os dados de <strong>{editTarget?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={editTarget?.nome ?? ""}
                onChange={e => setEditTarget(prev => prev ? { ...prev, nome: e.target.value } : prev)}
              />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={editTarget?.email ?? ""}
                onChange={e => setEditTarget(prev => prev ? { ...prev, email: e.target.value } : prev)}
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input
                placeholder="(15) 99999-9999"
                value={editTarget?.celular ?? ""}
                maxLength={15}
                onChange={e => setEditTarget(prev => prev ? { ...prev, celular: maskPhone(e.target.value) } : prev)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={doEditProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Convidar usuário */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) setInviteOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário diretamente. Ele poderá fazer login imediatamente com as credenciais informadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={inviteForm.nome}
                onChange={e => setInviteForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input
                placeholder="(15) 99999-9999"
                value={inviteForm.celular}
                maxLength={15}
                onChange={e => setInviteForm(f => ({ ...f, celular: maskPhone(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Senha temporária *</Label>
              <Input
                type="text"
                placeholder="Mínimo 6 caracteres"
                value={inviteForm.senha}
                onChange={e => setInviteForm(f => ({ ...f, senha: e.target.value }))}
              />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v as "vendedor" | "admin" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancelar</Button>
            <Button onClick={doInvite} disabled={inviting}>
              {inviting ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Excluir usuário */}
      <Dialog open={!!deleteUserTarget} onOpenChange={(o) => { if (!o) setDeleteUserTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir permanentemente <strong>"{deleteUserTarget?.nome}"</strong>?
              O usuário perderá acesso e seus dados de login serão removidos. Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDeleteUser}>Excluir permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover acesso</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o acesso de <strong>"{removeTarget?.nome}"</strong>?
              O usuário perderá todos os papéis atribuídos e não conseguirá acessar o sistema. Esta ação pode ser revertida atribuindo novamente um papel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doRemove}>Remover acesso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
