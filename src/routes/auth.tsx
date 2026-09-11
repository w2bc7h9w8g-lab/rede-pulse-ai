import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no RedePulse" },
      { name: "description", content: "Acesse sua conta do RedePulse para analisar publicações." },
      { property: "og:title", content: "Entrar no RedePulse" },
      { property: "og:description", content: "Acesse sua conta do RedePulse." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sentConfirmation, setSentConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const notConfirmed = /confirm/i.test(error.message);
      toast.error(
        notConfirmed ? "Confirme seu e-mail antes de entrar" : "Não foi possível entrar",
        {
          description: notConfirmed
            ? "Abra o link que enviamos para o seu e-mail. Se não chegou, peça um novo envio abaixo."
            : "Confira o e-mail e a senha e tente novamente.",
        },
      );
      if (notConfirmed) setSentConfirmation(true);
      return;
    }
    navigate({ to: "/inicio", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      const tooMany = /rate|limit|seconds/i.test(error.message);
      toast.error("Não foi possível criar a conta", {
        description: tooMany
          ? "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."
          : error.message,
      });
      return;
    }
    if (!data.session) {
      setSentConfirmation(true);
      return;
    }
    navigate({ to: "/inicio", replace: true });
  }

  async function handleResend() {
    if (!email.trim()) {
      toast.error("Informe seu e-mail para reenviar a confirmação.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      toast.error("Não conseguimos reenviar agora", { description: error.message });
      return;
    }
    toast.success("Enviamos um novo link de confirmação.");
  }

  async function handleGoogle() {
    setLoading(true);
    // Evita ficar preso em "carregando" se a janela do Google for fechada/bloqueada.
    const guard = window.setTimeout(() => setLoading(false), 45_000);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com o Google", {
          description:
            "A janela do Google foi fechada, bloqueada pelo navegador ou o acesso foi cancelado. Tente novamente.",
        });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.error("O Google respondeu, mas a sessão não ficou ativa. Tente novamente.");
        setLoading(false);
        return;
      }
      navigate({ to: "/inicio", replace: true });
    } catch (error) {
      toast.error("Não foi possível entrar com o Google", {
        description: error instanceof Error ? error.message : undefined,
      });
      setLoading(false);
    } finally {
      window.clearTimeout(guard);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">
              R
            </span>
            <span className="font-display text-xl font-semibold">RedePulse</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse para cadastrar sua rede e analisar publicações.
          </p>
        </div>

        {sentConfirmation ? (
          <div className="surface-card space-y-3 p-6 text-center">
            <h1 className="text-lg font-semibold">Confirme seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e clique
              no link para ativar sua conta.
            </p>
            <Button variant="outline" onClick={() => setSentConfirmation(false)}>
              Voltar
            </Button>
          </div>
        ) : (
          <div className="surface-card p-6">
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar" className="pt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input
                      id="senha"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="criar" className="pt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Seu nome</Label>
                    <Input
                      id="nome"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como podemos te chamar?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-novo">E-mail</Label>
                    <Input
                      id="email-novo"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha-nova">Senha</Label>
                    <Input
                      id="senha-nova"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Criar minha conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Continuar com o Google
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Nunca pedimos a senha do seu Instagram. A conexão com o Instagram é feita apenas pela
          conta oficial da campanha.
        </p>
      </div>
    </div>
  );
}
