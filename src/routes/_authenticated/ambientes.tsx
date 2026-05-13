import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SimpleList } from "./segmentos";

export const Route = createFileRoute("/_authenticated/ambientes")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) throw redirect({ to: "/orcamentos" });
  },
  component: () => <SimpleList table="ambientes" titulo="Ambientes" />,
});
