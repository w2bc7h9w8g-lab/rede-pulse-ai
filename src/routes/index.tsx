import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RedePulse — quem da sua rede participou da publicação" },
      {
        name: "description",
        content:
          "Cadastre a rede dos seus líderes, cole o link de uma publicação e veja quem comentou ou mencionou a campanha.",
      },
      { property: "og:title", content: "RedePulse — participação da rede em publicações" },
      {
        property: "og:description",
        content:
          "Cadastre a rede dos seus líderes, cole o link de uma publicação e veja quem participou.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Rede organizada",
    text: "Cada líder cadastra os @ da sua rede — um por vez ou centenas de uma só vez.",
  },
  {
    icon: MessageSquare,
    title: "Participação identificada",
    text: "Cole o link da publicação e veja quem comentou ou mencionou a campanha.",
  },
  {
    icon: BarChart3,
    title: "Relatórios em Excel",
    text: "Baixe tudo em planilha, com uma aba por dia e um resumo geral.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro por padrão",
    text: "Cada campanha fica isolada. Nunca pedimos a senha do Instagram de ninguém.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground">
            R
          </span>
          <span className="font-display text-lg font-semibold">RedePulse</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        <section className="py-12 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Para campanhas e candidaturas
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
            Descubra quem da rede dos seus líderes participou de cada publicação
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            O líder cadastra sua rede, cola o link de uma publicação do Instagram e recebe na hora a
            lista de quem comentou ou mencionou. Simples para quem não é da área técnica.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="surface-card p-6">
              <span className="inline-grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <feature.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </section>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          O RedePulse analisa apenas informações disponibilizadas pelas integrações autorizadas do
          Instagram, principalmente comentários e menções. Não é possível garantir a identificação
          de toda e qualquer forma de interação, e curtidas individuais não fazem parte desta
          versão.
        </p>
      </main>
    </div>
  );
}
