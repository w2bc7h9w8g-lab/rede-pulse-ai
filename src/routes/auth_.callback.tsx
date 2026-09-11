import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmando acesso — RedePulse" },
      {
        name: "description",
        content: "Estamos confirmando seu acesso ao RedePulse e levando você para o painel.",
      },
      { property: "og:title", content: "Confirmando acesso — RedePulse" },
      { property: "og:description", content: "Confirmação de acesso ao RedePulse." },
    ],
  }),
  component: AuthCallback,
});

type State = { status: "loading" } | { status: "error"; title: string; message: string };

function readParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (key: string) => search.get(key) ?? hash.get(key);
  return { get };
}

function describeError(code: string | null, description: string | null) {
  const text = (description ?? "").toLowerCase();
  if (code === "access_denied" && text.includes("expired")) {
    return {
      title: "Este link expirou",
      message:
        "O link de confirmação vale por pouco tempo. Volte para a tela de acesso e peça um novo e-mail de confirmação.",
    };
  }
  if (text.includes("already") || text.includes("confirmed")) {
    return {
      title: "Sua conta já estava confirmada",
      message: "Você pode entrar normalmente com seu e-mail e senha.",
    };
  }
  if (code === "access_denied") {
    return {
      title: "Acesso cancelado",
      message: "A confirmação foi cancelada. Tente novamente quando quiser.",
    };
  }
  return {
    title: "Não conseguimos confirmar seu acesso",
    message:
      description ||
      "O link pode ter sido usado, expirado ou aberto em outro navegador. Peça um novo e-mail de confirmação.",
  };
}

function AuthCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { get } = readParams();

      const errorCode = get("error_code") ?? get("error");
      if (errorCode) {
        const info = describeError(get("error"), get("error_description"));
        if (!cancelled) setState({ status: "error", ...info });
        return;
      }

      const code = get("code");
      const tokenHash = get("token_hash");
      const type = get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "signup") ?? "signup",
          });
          if (error) throw error;
        }

        // Implicit flow tokens in the hash are consumed by the client automatically.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (!cancelled) navigate({ to: "/inicio", replace: true });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!cancelled) {
          setState({
            status: "error",
            title: "Não encontramos uma sessão ativa",
            message:
              "A confirmação pode ter sido feita em outro navegador. Volte e entre com seu e-mail e senha.",
          });
        }
      } catch (error) {
        if (cancelled) return;
        const info = describeError(null, error instanceof Error ? error.message : null);
        setState({ status: "error", ...info });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Confirmando seu acesso…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="surface-card max-w-md space-y-3 p-6 text-center">
        <h1 className="text-lg font-semibold">{state.title}</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button asChild className="mt-2">
          <Link to="/auth">Voltar para o acesso</Link>
        </Button>
      </div>
    </div>
  );
}
