import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  head: () => ({
    meta: [
      { title: "Trocar senha — RedePulse" },
      { name: "description", content: "Defina uma nova senha para continuar usando a plataforma." },
      { property: "og:title", content: "Trocar senha — RedePulse" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As duas senhas digitadas não são iguais.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const message = /compromised|pwned|leaked/i.test(error.message)
          ? "Essa senha já apareceu em vazamentos. Escolha outra."
          : /different from the old/i.test(error.message)
            ? "A nova senha precisa ser diferente da atual."
            : error.message;
        toast.error("Não foi possível trocar a senha", { description: message });
        return;
      }

      const { error: flagError } = await supabase.rpc("clear_must_change_password");
      if (flagError) throw flagError;

      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Senha alterada! Acesso liberado.");
      navigate({ to: "/inicio", replace: true });
    } catch (error) {
      toast.error("Não foi possível concluir", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="size-5" /> Troque sua senha
          </CardTitle>
          <CardDescription>
            Por segurança, é preciso definir uma nova senha antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirma">Repita a nova senha</Label>
              <Input
                id="confirma"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !session}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
