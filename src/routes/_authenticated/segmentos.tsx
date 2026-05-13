import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
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

export function SimpleList({ table, titulo }: { table: "segmentos" | "ambientes"; titulo: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [novo, setNovo] = useState("");

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

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{titulo}</h1>
      <Card className="p-4 mb-4">
        <div className="flex gap-2">
          <Input placeholder={`Novo ${titulo.toLowerCase().slice(0, -1)}...`} value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="w-32">Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.nome}</TableCell>
                <TableCell><Switch checked={r.status} onCheckedChange={() => toggle(r.id, r.status)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
