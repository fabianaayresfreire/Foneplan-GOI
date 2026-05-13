import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);

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

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-1">Usuários</h1>
      <p className="text-sm text-muted-foreground mb-6">Promova vendedores a administradores conforme necessário. Novos usuários se cadastram pela tela de login.</p>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papéis</TableHead><TableHead className="w-48 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => {
              const isAdmin = r.roles.includes("admin");
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    {r.roles.map((rr: string) => (
                      <span key={rr} className={`mr-1 inline-block px-2 py-0.5 rounded text-xs font-semibold ${rr === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {rr}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={isAdmin ? "outline" : "default"} onClick={() => toggleAdmin(r.id, isAdmin)}>
                      {isAdmin ? "Remover admin" : "Tornar admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
