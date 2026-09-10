import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { formatNumber, formatPercent } from "@/lib/format";
import { fetchAnalyses } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/equipe/")({
  head: () => ({
    meta: [
      { title: "Minha equipe — RedePulse" },
      { name: "description", content: "Cadastre líderes e acompanhe o desempenho de cada rede." },
      { property: "og:title", content: "Minha equipe — RedePulse" },
      { property: "og:description", content: "Cadastre líderes e acompanhe cada rede." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const coordinator = isCoordinator(session);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["equipe"],
    queryFn: async () => {
      const [{ data: leaders, error }, { data: members }, analyses] = await Promise.all([
        supabase
          .from("leaders")
          .select("id, name, invite_email, phone, status, user_id")
          .order("name"),
        supabase.from("network_members").select("id, leader_id").eq("active", true),
        fetchAnalyses(),
      ]);
      if (error) throw error;
      return { leaders: leaders ?? [], members: members ?? [], analyses };
    },
    enabled: coordinator,
  });

  if (!coordinator) {
    return (
      <EmptyState
        title="Área da coordenação"
        description="Esta página é exclusiva de quem coordena a campanha."
      />
    );
  }

  const stats = (leaderId: string) => {
    const list = (data?.analyses ?? []).filter(
      (a) => a.leader_id === leaderId && a.status === "completed",
    );
    const avg = list.length
      ? list.reduce((s, a) => s + Number(a.participation_rate), 0) / list.length
      : 0;
    return {
      network: (data?.members ?? []).filter((m) => m.leader_id === leaderId).length,
      analyses: list.length,
      avg,
    };
  };

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.campaign?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("leaders").insert({
        campaign_id: session.campaign.id,
        name: name.trim(),
        invite_email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
      });
      if (error) throw error;
      toast.success("Líder cadastrado!", {
        description: email
          ? "Peça para ele criar a conta com este mesmo e-mail para acessar a rede."
          : undefined,
      });
      setName("");
      setEmail("");
      setPhone("");
      await queryClient.invalidateQueries({ queryKey: ["equipe"] });
    } catch (error) {
      toast.error("Não foi possível cadastrar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, status: string) {
    const next = (status === "active" ? "inactive" : "active") as "active" | "inactive";
    const { error } = await supabase.from("leaders").update({ status: next }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["equipe"] });
  }

  const ranking = [...(data?.leaders ?? [])].sort(
    (a, b) => stats(b.id).avg - stats(a.id).avg,
  );

  return (
    <>
      <PageHeader
        title="Minha equipe"
        description="Cadastre seus líderes. Cada um monta a própria rede e vê apenas os resultados dela."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Cadastrar líder</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="nome-lider">Nome do líder</Label>
              <Input
                id="nome-lider"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Ana Souza"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email-lider">E-mail de acesso</Label>
              <Input
                id="email-lider"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-lider">WhatsApp (opcional)</Label>
              <Input
                id="tel-lider"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Cadastrar líder
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Assim que o líder criar a conta com esse e-mail, o acesso à rede dele é liberado
            automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líderes ({data?.leaders.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : ranking.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Nenhum líder cadastrado"
              description="Cadastre o primeiro líder para começar a organizar as redes."
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {ranking.map((leader) => {
                const s = stats(leader.id);
                return (
                  <div
                    key={leader.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/equipe/$leaderId"
                        params={{ leaderId: leader.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {leader.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {leader.invite_email ?? "sem e-mail"} ·{" "}
                        {leader.user_id ? "acesso ativo" : "aguardando primeiro acesso"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatNumber(s.network)} na rede</Badge>
                      <Badge variant="outline">{s.analyses} análises</Badge>
                      <Badge variant="secondary">{formatPercent(s.avg)}</Badge>
                      {leader.status !== "active" ? <Badge>Inativo</Badge> : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(leader.id, leader.status)}
                      >
                        {leader.status === "active" ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
