import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: session, isLoading } = useSession();
  const navigate = useNavigate();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (session.mustChangePassword) {
      if (pathname !== "/trocar-senha") navigate({ to: "/trocar-senha", replace: true });
      return;
    }
    if (needsOnboarding(session) && pathname !== "/bem-vindo") {
      navigate({ to: "/bem-vindo", replace: true });
    }
  }, [isLoading, session, navigate, pathname]);

  if (isLoading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session.role || !session.campaign) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <AppShell session={session}>
      <Outlet />
    </AppShell>
  );
}
