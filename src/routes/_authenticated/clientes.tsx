import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { maskCpfCnpj, maskCep, maskPhone, fetchViaCep } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/clientes")({ component: ClientesPage });

const empty = {
  nome_razao_social: "", cpf_cnpj: "", rg_inscricao: "",
  email: "", telefone: "", celular: "",
  endereco: "", bairro: "", cidade: "", estado: "", cep: "",
  endereco_instalacao: "", responsavel_obra: "",
  celular_responsavel_obra: "", email_responsavel_obra: "",
  arquiteto_id: null as string | null,
  informacoes_adicionais: "",
};

/** Retorna true se o e-mail for válido OU vazio/nulo (campo opcional). */
const isValidEmail = (v: string | null | undefined) => {
  if (!v || !v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim());
};

const emptyEmailErrors = { email: false, emailResponsavel: false };

function ClientesPage() {
  const { user } = useAuth();
  const [rows, setRows]       = useState<any[]>([]);
  const [arqs, setArqs]       = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [open, setOpen]       = useState(false);
  const [edit, setEdit]       = useState<any>(null);
  const [form, setForm]       = useState<any>(empty);
  const [emailErrors, setEmailErrors] = useState(emptyEmailErrors);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  // CEP lookup state
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErr, setCepErr]         = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("clientes")
      .select("*, arquitetos(nome)")
      .order("numero_cliente", { ascending: false });
    setRows(data || []);
    const { data: a } = await supabase
      .from("arquitetos").select("id,nome").eq("status", true).order("nome");
    setArqs(a || []);
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setEdit(null); setForm(empty); setEmailErrors(emptyEmailErrors); setCepErr(""); setOpen(true); };
  const openEdit = (c: any) => {
    setEdit(c);
    setForm({ ...empty, ...c, arquiteto_id: c.arquiteto_id });
    setEmailErrors(emptyEmailErrors);
    setCepErr("");
    setOpen(true);
  };

  // ── CEP ────────────────────────────────────────────────────────────────────
  const handleCepChange = async (raw: string) => {
    const masked = maskCep(raw);
    setForm((prev: any) => ({ ...prev, cep: masked }));
    setCepErr("");

    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepLoading(true);
    const result = await fetchViaCep(masked);
    setCepLoading(false);

    if (result === "not_found") { setCepErr("CEP não encontrado."); return; }
    if (result === "error")     { setCepErr("Erro ao buscar CEP. Verifique sua conexão."); return; }

    setForm((prev: any) => ({
      ...prev,
      endereco: result.logradouro || prev.endereco,
      bairro:   result.bairro     || prev.bairro,
      cidade:   result.localidade || prev.cidade,
      estado:   result.uf         || prev.estado,
    }));
  };

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.nome_razao_social.trim()) return toast.error("Nome obrigatório");

    const errs = {
      email:            !isValidEmail(form.email),
      emailResponsavel: !isValidEmail(form.email_responsavel_obra),
    };
    setEmailErrors(errs);
    if (errs.email || errs.emailResponsavel) return toast.error("Corrija os e-mails inválidos.");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { arquitetos: _arqJoin, numero_cliente: _num, id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...formData } = form;
    const payload = { ...formData, arquiteto_id: form.arquiteto_id || null };
    if (edit) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("clientes").insert({ ...payload, created_by: user!.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); setOpen(false); load();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    // Verifica orçamentos vinculados antes de deletar
    const { count } = await supabase
      .from("orcamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", deleteTarget.id);
    if (count && count > 0) {
      toast.error("Não é possível excluir: este cliente possui orçamentos vinculados. Edite o cliente caso necessário.");
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from("clientes").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Cliente "${deleteTarget.nome}" excluído.`);
    setDeleteTarget(null);
    load();
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.nome_razao_social?.toLowerCase().includes(s) ||
      r.cpf_cnpj?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      String(r.numero_cliente).includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre e reaproveite clientes nos orçamentos.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo cliente</Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, CPF/CNPJ, e-mail, número..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Nome / Razão social</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Arquiteto</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">#{r.numero_cliente}</TableCell>
                <TableCell className="font-medium">{r.nome_razao_social}</TableCell>
                <TableCell>{r.cpf_cnpj || "—"}</TableCell>
                <TableCell>{[r.cidade, r.estado].filter(Boolean).join("/") || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.arquitetos?.nome || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: r.id, nome: r.nome_razao_social })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum cliente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Dialog de confirmação de exclusão ──────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.nome}"</strong>? Todos os orçamentos vinculados a este cliente também serão excluídos. Esta ação é permanente e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de cadastro ─────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* Nome */}
            <div className="md:col-span-2">
              <Label>Nome / Razão social *</Label>
              <Input value={form.nome_razao_social}
                onChange={(e) => setForm({ ...form, nome_razao_social: e.target.value })} />
            </div>

            {/* CPF/CNPJ — máscara automática (1.2) */}
            <div>
              <Label>CPF / CNPJ</Label>
              <Input
                value={form.cpf_cnpj}
                onChange={(e) => setForm({ ...form, cpf_cnpj: maskCpfCnpj(e.target.value) })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
            </div>

            {/* RG / Inscrição — campo completo, sem truncamento (1.5) */}
            <div>
              <Label>RG / Inscrição Estadual</Label>
              <Input value={form.rg_inscricao}
                onChange={(e) => setForm({ ...form, rg_inscricao: e.target.value })}
                placeholder="Ex.: 12.345.678-9 ou 123.456.789.000" />
            </div>

            {/* E-mail com validação */}
            <div>
              <Label>E-mail</Label>
              <Input
                type="text"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (emailErrors.email)
                    setEmailErrors(p => ({ ...p, email: !isValidEmail(e.target.value) }));
                }}
                onBlur={(e) => setEmailErrors(p => ({ ...p, email: !isValidEmail(e.target.value) }))}
                className={emailErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailErrors.email && (
                <p className="text-xs text-destructive mt-1">E-mail inválido. Use o formato nome@dominio.com</p>
              )}
            </div>

            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                placeholder="(15) 3224-2316"
                maxLength={15} />
            </div>

            <div>
              <Label>Celular</Label>
              <Input value={form.celular}
                onChange={(e) => setForm({ ...form, celular: maskPhone(e.target.value) })}
                placeholder="(15) 99999-9999"
                maxLength={15} />
            </div>

            {/* CEP com busca ViaCEP (1.4) */}
            <div>
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className={cepErr ? "border-destructive focus-visible:ring-destructive pr-8" : "pr-8"}
                />
                {cepLoading && (
                  <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              {cepErr && <p className="text-xs text-destructive mt-1">{cepErr}</p>}
            </div>

            {/* Endereço — preenchido pelo CEP */}
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>

            {/* Bairro + Cidade */}
            <div>
              <Label>Bairro</Label>
              <Input value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>

            {/* Estado */}
            <div>
              <Label>Estado (UF)</Label>
              <Input value={form.estado} maxLength={2}
                onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                placeholder="SP" />
            </div>

            {/* Endereço de instalação */}
            <div className="md:col-span-2">
              <Label>Endereço de instalação / obra</Label>
              <Input value={form.endereco_instalacao}
                onChange={(e) => setForm({ ...form, endereco_instalacao: e.target.value })} />
            </div>

            {/* Responsável */}
            <div>
              <Label>Responsável pela obra</Label>
              <Input value={form.responsavel_obra}
                onChange={(e) => setForm({ ...form, responsavel_obra: e.target.value })} />
            </div>
            <div>
              <Label>Celular do responsável</Label>
              <Input value={form.celular_responsavel_obra}
                onChange={(e) => setForm({ ...form, celular_responsavel_obra: maskPhone(e.target.value) })}
                placeholder="(15) 99999-9999"
                maxLength={15} />
            </div>

            {/* E-mail do responsável com validação */}
            <div className="md:col-span-2">
              <Label>E-mail do responsável</Label>
              <Input
                type="text"
                value={form.email_responsavel_obra}
                onChange={(e) => {
                  setForm({ ...form, email_responsavel_obra: e.target.value });
                  if (emailErrors.emailResponsavel)
                    setEmailErrors(p => ({ ...p, emailResponsavel: !isValidEmail(e.target.value) }));
                }}
                onBlur={(e) => setEmailErrors(p => ({ ...p, emailResponsavel: !isValidEmail(e.target.value) }))}
                className={emailErrors.emailResponsavel ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailErrors.emailResponsavel && (
                <p className="text-xs text-destructive mt-1">E-mail inválido. Use o formato nome@dominio.com</p>
              )}
            </div>

            {/* Arquiteto */}
            <div className="md:col-span-2">
              <Label>Arquiteto vinculado</Label>
              <Select
                value={form.arquiteto_id || "none"}
                onValueChange={(v) => setForm({ ...form, arquiteto_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {arqs.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Informações adicionais */}
            <div className="md:col-span-2">
              <Label>Informações adicionais</Label>
              <Textarea rows={3} value={form.informacoes_adicionais}
                onChange={(e) => setForm({ ...form, informacoes_adicionais: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
