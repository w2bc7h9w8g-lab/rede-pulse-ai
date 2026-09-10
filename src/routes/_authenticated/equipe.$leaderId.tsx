import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { buildAnalysisSheets, fetchAnalyses, fetchInteractions } from "@/lib/reports";
import { downloadXlsx } from "@/lib/excel";

export const Route = createFileRoute("/_authenticated/equipe/$leaderId")({
  head: () => ({
    meta: [
      { title: "Líder — RedePulse" },
      { name: "description", content: "Rede e resultados de um líder da campanha." },
      { property: "og:title", content: "Líder — RedePulse" },
      { property: "og:description", content: "Rede e resultados de um líder." },
    ],
  }),
  component: LeaderDetail,
});

function LeaderDetail() {
  const { leaderId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["lider", leaderId],
    queryFn: async () => {
      const [{ data: leader }, { data: members }, analyses] = await Promise.all([
        supabase
          .from("leaders")
          .select("id, name, invite_email, phone, status")
          .eq("id", leaderId)
          .maybeSingle(),
        supabase
          .from("network_members")
          .select("instagram_username, display_name, active, created_at")
          .eq("leader_id", leaderId)
          .order("instagram_username"),
        fetchAnalyses({ leaderId }),
      ]);
      return { leader, members: members ?? [], analyses };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.leader) {
    return (
      <EmptyState
        title="Líder não encontrado"
        action={
          <Button asChild variant="outline">
            <Link to="/equipe">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const completed = data.analyses.filter((a) => a.status === "completed");
  const avg = completed.length
    ? completed.reduce((s, a) => s + Number(a.participation_rate), 0) / completed.length
    : 0;

  async function handleExport() {
    const interactions = await fetchInteractions(data!.analyses.map((a) => a.id));
    try {
      await downloadXlsx(
        buildAnalysisSheets(data!.analyses, interactions),
        `relatorio-${data!.leader!.name}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/equipe">
          <ArrowLeft className="size-4" /> Voltar para a equipe
        </Link>
      </Button>

      <PageHeader
        title={data.leader.name}
        description={data.leader.invite_email ?? "Sem e-mail cadastrado"}
        actions={
          <Button onClick={handleExport} disabled={data.analyses.length === 0}>
            <FileSpreadsheet className="size-4" /> Exportar Excel
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pessoas na rede"
          value={formatNumber(data.members.filter((m) => m.active).length)}
          icon={Users}
        />
        <StatCard label="Análises" value={formatNumber(completed.length)} />
        <StatCard label="Participação média" value={formatPercent(avg)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análises da rede</CardTitle>
        </CardHeader>
        <CardContent>
          {data.analyses.length === 0 ? (
            <EmptyState title="Este líder ainda não fez análises" />
          ) : (
            <div className="space-y-2">
              {data.analyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  to="/analise/$id"
                  params={{ id: analysis.id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatDateTime(analysis.analyzed_at)}</p>
                    <p className="truncate text-xs text-muted-foreground">{analysis.url}</p>
                  </div>
                  <Badge variant="secondary">
                    {analysis.identified_participants_count}/{analysis.network_size_snapshot} ·{" "}
                    {formatPercent(Number(analysis.participation_rate))}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rede cadastrada ({data.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <EmptyState title="Nenhum perfil cadastrado nesta rede" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.members.map((member) => (
                <Badge
                  key={member.instagram_username}
                  variant={member.active ? "outline" : "secondary"}
                >
                  @{member.instagram_username}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
