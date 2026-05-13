import { createFileRoute, Outlet, Link, useNavigate, redirect, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Users, Building2, Package, LayoutGrid, Tag,
  LogOut, ShieldCheck, Boxes, Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/foneplan-logo.png";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: Layout,
});

function Layout() {
  const { user, role, isAdmin, signOut, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  const navItems = [
    { to: "/orcamentos", label: "Orçamentos", icon: FileText, show: true },
    { to: "/clientes", label: "Clientes", icon: Users, show: true },
    { to: "/arquitetos", label: "Arquitetos", icon: Building2, show: true },
    { to: "/produtos", label: "Produtos", icon: Package, show: isAdmin },
    { to: "/segmentos", label: "Segmentos", icon: LayoutGrid, show: isAdmin },
    { to: "/ambientes", label: "Ambientes", icon: Tag, show: isAdmin },
    { to: "/usuarios", label: "Usuários", icon: ShieldCheck, show: isAdmin },
  ];

  const SidebarBody = (
    <>
      <div className="p-5 flex items-center gap-3">
        <img src={logo} alt="" width={36} height={36} />
        <div>
          <div className="font-bold tracking-tight text-sidebar-foreground leading-none">
            FONEPLAN <span className="text-primary">GOI</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            Orçamentos
          </div>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter(i => i.show).map(({ to, label, icon: Icon }) => {
          const active = loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Separator className="bg-sidebar-border" />
      <div className="p-3 space-y-2">
        <div className="px-2">
          <div className="text-xs text-muted-foreground">Conectado como</div>
          <div className="text-sm font-medium truncate text-sidebar-foreground">
            {user?.email}
          </div>
          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold uppercase tracking-wider">
            <Boxes className="h-3 w-3" />
            {role || "..."}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground"
          onClick={async () => {
            await signOut();
            nav({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background no-print">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        {SidebarBody}
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 border-b border-sidebar-border bg-sidebar">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border flex flex-col">
              {SidebarBody}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logo} alt="" width={28} height={28} />
            <div className="font-bold tracking-tight text-sidebar-foreground text-sm">
              FONEPLAN <span className="text-primary">GOI</span>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
