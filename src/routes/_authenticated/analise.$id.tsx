import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ExternalLink, FileSpreadsheet, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PrivacyNotice } from "@/components/app/DemoNotice";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatNumber, formatPercent, interactionLabel } from "@/lib/format";
import { buildAnalysisSheets, fetchInteractions, type AnalysisRecord } from "@/lib/reports";
import { downloadXlsx } from "@/lib/excel";

export const Route = createFileRoute("/_authenticated/analise/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da análise — RedePulse" },
      { name: "description", content: "Veja quem da rede participou desta publicação." },
      { property: "og:title", content: "Detalhe da análise — RedePulse" },
      { property: "og:description", content: "Quem da rede participou desta publicação." },
    ],
  }),
  component: AnalysisDetail,
});

function AnalysisDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["analise", id],
    queryFn: async () => {
      const { data: analysis, error } = await supabase
        .from("analyses")
        .select(
          "id, analyzed_at, url, shortcode, status, source, error_message, network_size_snapshot, identified_participants_count, participation_rate, leader_id, leaders(id, name), posts(likes_count, comments_count, shares_count, reach, impressions)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!analysis) return null;

      const interactions = await fetchInteractions([id]);

      const { data: members } = await supabase
        .from("network_members")
        .select("instagram_username, display_name")
        .eq("leader_id", (analysis as unknown as AnalysisRecord).leader_id)
        .eq("active", true);

      return {
        analysis: analysis as unknown as AnalysisRecord,
        interactions,
        members: members ?? [],
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data) {
    return (
      <EmptyState
        title="Análise não encontrada"
        description="Ela pode ter sido removida ou pertence a outra campanha."
        action={
          <Button asChild variant="outline">
            <Link to="/historico">Voltar ao histórico</Link>
          </Button>
        }
      />
    );
  }

  const { analysis, interactions, members } = data;
  const participants = new Map<string, typeof interactions>();
  for (const interaction of interactions) {
    const key = interaction.instagram_username.toLowerCase();
    participants.set(key, [...(participants.get(key) ?? []), interaction]);
  }
  const nameByUsername = new Map(
    members.map((m) => [m.instagram_username.toLowerCase(), m.display_name] as const),
  );
  const absent = members.filter((m) => !participants.has(m.instagram_username.toLowerCase()));

  async function handleExport() {
    try {
      await downloadXlsx(
        buildAnalysisSheets([analysis], interactions),
        `analise-${analysis.shortcode ?? analysis.id.slice(0, 8)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/historico">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={`Análise de ${formatDateTime(analysis.analyzed_at)}`}
        description={`Rede de ${analysis.leaders?.name ?? "líder"}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={analysis.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Abrir publicação
              </a>
            </Button>
            <Button onClick={handleExport}>
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </Button>
          </>
        }
      />

      {analysis.status !== "completed" ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <strong>Esta análise não foi concluída.</strong>{" "}
            {analysis.error_message ?? "Tente novamente em alguns minutos."}
          </p>
        </div>
      ) : null}

      {analysis.source === "demo" ? (
        <Badge variant="outline" className="w-fit">
          Dados de demonstração
        </Badge>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Participação identificada"
          value={formatPercent(Number(analysis.participation_rate))}
          icon={UserCheck}
        />
        <StatCard
          label="Participaram"
          value={formatNumber(analysis.identified_participants_count)}
        />
        <StatCard label="Tamanho da rede" value={formatNumber(analysis.network_size_snapshot)} />
        <StatCard
          label="Comentários da publicação"
          value={formatNumber(analysis.posts?.comments_count ?? null)}
          hint={
            analysis.posts?.likes_count
              ? `${formatNumber(analysis.posts.likes_count)} curtidas no total`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quem participou ({participants.size})</CardTitle>
        </CardHeader>
        <CardContent>
          {participants.size === 0 ? (
            <EmptyState
              title="Ninguém da rede foi identificado nesta publicação"
              description="Identificamos participação por comentários e menções. Curtidas individuais não são disponibilizadas pelo Instagram."
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {[...participants.entries()].map(([username, list]) => (
                <div key={username} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      @{username}
                      {nameByUsername.get(username) ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {nameByUsername.get(username)}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex gap-1">
                      {[...new Set(list.map((i) => i.interaction_type))].map((type) => (
                        <Badge key={type} variant="secondary">
                          {interactionLabel(type)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {list
                    .filter((i) => i.comment_text)
                    .map((i) => (
                      <p key={i.id} className="text-sm text-muted-foreground">
                        “{i.comment_text}”
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ainda não identificados ({absent.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {absent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Toda a rede participou. Parabéns!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {absent.map((member) => (
                <Badge key={member.instagram_username} variant="outline">
                  @{member.instagram_username}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PrivacyNotice />
    </>
  );
}
