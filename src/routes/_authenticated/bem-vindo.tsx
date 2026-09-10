import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { seedDemoData } from "@/lib/demo-seed";

export const Route = createFileRoute("/_authenticated/bem-vindo")({
  component: Welcome,
});

function Welcome() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [candidate, setCandidate] = useState("");
  const [instagram, setInstagram] = useState("");
  const [withDemo, setWithDemo] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setLoading(true);
    try {
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          name: name.trim(),
          candidate_name: candidate.trim() || null,
          instagram_username: instagram.trim().replace(/^@/, "") || null,
          is_demo: withDemo,
        })
        .select("id")
        .single();
      if (error || !campaign) throw error ?? new Error("Falha ao criar a campanha.");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ campaign_id: campaign.id })
        .eq("id", session.userId);
      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: session.userId, role: "coordinator", campaign_id: campaign.id });
      if (roleError) throw roleError;

      if (withDemo) await seedDemoData(campaign.id);

      await queryClient.invalidateQueries();
      toast.success("Campanha criada!");
      navigate({ to: "/inicio", replace: true });
    } catch (error) {
      toast.error("Não foi possível criar a campanha", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="surface-card space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <span className="inline-grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold">Bem-vindo ao RedePulse</h1>
          <p className="text-sm text-muted-foreground">
            Vamos criar a sua campanha. Depois você cadastra seus líderes e cada um monta a própria
            rede.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campanha">Nome da campanha</Label>
            <Input
              id="campanha"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Campanha 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="candidato">Nome do candidato (opcional)</Label>
            <Input
              id="candidato"
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              placeholder="Ex.: Maria Andrade"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ig">@ do Instagram da campanha (opcional)</Label>
            <Input
              id="ig"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@suacampanha"
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <Checkbox
              checked={withDemo}
              onCheckedChange={(value) => setWithDemo(value === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Incluir dados de demonstração</span>
              <span className="block text-muted-foreground">
                Cria 2 líderes de exemplo, com redes e análises fictícias, para você conhecer o
                sistema. Tudo fica marcado como demonstração.
              </span>
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Criar campanha
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Se você é líder e recebeu um convite, peça ao coordenador para cadastrar o seu e-mail —
          assim que ele fizer isso, é só entrar novamente que sua área aparece automaticamente.
        </p>
      </div>
    </div>
  );
}
