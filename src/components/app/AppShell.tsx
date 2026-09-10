import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Home,
  Instagram,
  LineChart,
  LogOut,
  Menu,
  Users,
  UsersRound,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isCoordinator, type SessionInfo } from "@/lib/session";
import { DemoBadge } from "./DemoNotice";

type NavItem = { to: string; label: string; icon: typeof Home };

function buildNav(session: SessionInfo): NavItem[] {
  const coordinator = isCoordinator(session);
  const items: NavItem[] = [
    { to: "/inicio", label: "Início", icon: Home },
    { to: "/nova-analise", label: "Nova análise", icon: Sparkles },
  ];
  if (session.leaderId) items.push({ to: "/minha-rede", label: "Minha rede", icon: Users });
  items.push({ to: "/historico", label: "Histórico", icon: LineChart });
  items.push({ to: "/relatorios", label: "Relatórios", icon: BarChart3 });
  if (coordinator) {
    items.push({ to: "/equipe", label: "Minha equipe", icon: UsersRound });
    items.push({ to: "/conta-instagram", label: "Conta do Instagram", icon: Instagram });
  }
  return items;
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-display text-base font-bold text-sidebar-primary-foreground">
        R
      </span>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold text-sidebar-foreground">RedePulse</p>
        <p className="text-[11px] text-sidebar-foreground/70">Participação em publicações</p>
      </div>
    </div>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const items = buildNav(session);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel =
    session.role === "coordinator"
      ? "Coordenação"
      : session.role === "superadmin"
        ? "Administração"
        : "Liderança";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-sidebar p-4 lg:flex">
        <div className="space-y-6">
          <Brand />
          <NavLinks items={items} />
        </div>
        <div className="space-y-3 border-t border-sidebar-border pt-4">
          <div className="px-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{session.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              {roleLabel} · {session.campaign?.name ?? "Sem campanha"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="space-y-6">
                <Brand />
                <NavLinks items={items} onNavigate={() => setOpen(false)} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="size-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <p className="font-display text-base font-semibold">RedePulse</p>
          {session.campaign?.is_demo ? <DemoBadge /> : <span className="w-8" />}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
