import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/segmentos")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: () => <SimpleList table="segmentos" titulo="Segmentos" />,
});

type ArchiveTarget = { id: string; nome: string } | null;

export function SimpleList({ table, titulo }: { table: "segmentos" | "ambientes"; titulo: string }) {
  const [rows, setRows]               = useState<any[]>([]);
  const [novo, setNovo]               = useState("");
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget>(null);

  const singular = titulo.toLowerCase().slice(0, -1); // "segmento" | "ambiente"

  const load = async () => {
    const { data } = await supabase.from(table).select("*").order("ordem");
    setRows(data || []);
  };
  useEffect(() => { load(); }, [table]);

  const add = async () => {
    if (!novo.trim()) return;
    const { error } = await supabase.from(table).insert({ nome: novo.trim(), ordem: rows.length + 1 });
    if (error) return toast.error(error.message);
    setNovo(""); load();
  };

  const toggle = async (id: string, status: boolean) => {
    await supabase.from(table).update({ status: !status }).eq("id", id);
    load();
  };

  const doDelete = async () => {
    if (!archiveTarget) return;
    // Verifica referências antes de excluir
    const refTable = table === "segmentos" ? "orcamento_itens" : "orcamento_itens";
    const refCol   = table === "segmentos" ? "segmento_id" : "ambiente_id";
    const { count } = await supabase.from(refTable).select("id", { count: "exact", head: true }).eq(refCol, archiveTarget.id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: "${archiveTarget.nome}" está em uso em ${count} item(ns) de orçamento.`);
      setArchiveTarget(null);
      return;
    }
    const { error } = await supabase.from(table).delete().eq("id", archiveTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${archiveTarget.nome}" excluído`);
    setArchiveTarget(null);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{titulo}</h1>

      <Card className="p-4 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Nome do novo ${singular}...`}
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={!novo.trim()}>
            <Plus className="h-4 w-4 mr-2" />Adicionar
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-24">Ativo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.nome}</TableCell>
                <TableCell>
                  <Switch checked={r.status} onCheckedChange={() => toggle(r.id, r.status)} />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon" variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setArchiveTarget({ id: r.id, nome: r.nome })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum {singular}.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de confirmação */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {singular}</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>"{archiveTarget?.nome}"</strong>?
              Esta ação é permanente. Se estiver em uso em orçamentos, a exclusão será bloqueada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
