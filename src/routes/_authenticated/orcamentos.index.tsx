import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Edit, Copy, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { brl, STATUS_LABELS } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  component: OrcamentosList,
});

function OrcamentosList() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendFilter, setVendFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("orcamentos")
      .select("*, clientes(nome_razao_social), profiles!orcamentos_vendedor_id_fkey(nome,email)")
      .order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data || []);
    if (isAdmin) {
      const { data: ps } = await supabase.from("profiles").select("id,nome,email");
      setVendedores(ps || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [isAdmin]);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (isAdmin && vendFilter !== "all" && r.vendedor_id !== vendFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const c = r.clientes?.nome_razao_social?.toLowerCase() || "";
      return (
        c.includes(s) ||
        r.nome_projeto?.toLowerCase().includes(s) ||
        String(r.numero_orcamento).includes(s)
      );
    }
    return true;
  });

  const duplicate = async (id: string) => {
    const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", id).single();
    if (!orc) return;
    const { id: _i, numero_orcamento: _n, created_at: _c, updated_at: _u, ...rest } = orc;
    const { data: novo, error } = await supabase
      .from("orcamentos")
      .insert({ ...rest, vendedor_id: user!.id, status: "rascunho", nome_projeto: `${rest.nome_projeto} (cópia)` })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { data: itens } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", id);
    if (itens?.length) {
      const novos = itens.map((it: any) => {
        const { id: _x, created_at: _y, ...rs } = it;
        return { ...rs, orcamento_id: novo.id };
      });
      await supabase.from("orcamento_itens").insert(novos);
    }
    toast.success("Orçamento duplicado");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Visão geral de todos os orçamentos" : "Meus orçamentos"}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/orcamentos/novo">
            <Plus className="h-4 w-4 mr-2" /> Novo orçamento
          </Link>
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente, projeto..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={vendFilter} onValueChange={setVendFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome || v.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Projeto</TableHead>
              {isAdmin && <TableHead>Vendedor</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor final</TableHead>
              <TableHead className="text-right w-[180px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum orçamento encontrado.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">#{r.numero_orcamento}</TableCell>
                <TableCell>{r.clientes?.nome_razao_social ?? "—"}</TableCell>
                <TableCell>{r.nome_projeto}</TableCell>
                {isAdmin && (
                  <TableCell className="text-sm text-muted-foreground">
                    {r.profiles?.nome || r.profiles?.email || "—"}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor_final)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="icon" variant="ghost" title="Editar">
                      <Link to="/orcamentos/$id" params={{ id: r.id }}><Edit className="h-4 w-4" /></Link>
                    </Button>
                    <Button asChild size="icon" variant="ghost" title="PDF">
                      <Link to="/orcamentos/$id/pdf" params={{ id: r.id }}><FileText className="h-4 w-4" /></Link>
                    </Button>
                    <Button size="icon" variant="ghost" title="Duplicar" onClick={() => duplicate(r.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
