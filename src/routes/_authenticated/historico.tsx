import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { buildAnalysisSheets, fetchAnalyses, fetchInteractions } from "@/lib/reports";
import { downloadXlsx } from "@/lib/excel";
import { brDayKey, formatDateTime, formatPercent } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — RedePulse" },
      { name: "description", content: "Todas as análises de participação já realizadas." },
      { property: "og:title", content: "Histórico — RedePulse" },
      { property: "og:description", content: "Todas as análises já realizadas." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: session } = useSession();
  const coordinator = isCoordinator(session);
  const [leaderFilter, setLeaderFilter] = useState("todos");

  const { data: leaders } = useQuery({
    queryKey: ["leaders-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leaders").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: coordinator,
  });

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["historico", leaderFilter, session?.leaderId],
    queryFn: () =>
      fetchAnalyses({
        leaderId: coordinator ? (leaderFilter === "todos" ? null : leaderFilter) : session?.leaderId,
      }),
  });

  async function handleExport() {
    if (!analyses || analyses.length === 0) {
      toast.error("Não há análises para exportar.");
      return;
    }
    setExporting(true);
    try {
      const interactions = await fetchInteractions(analyses.map((a) => a.id));
      const sheets = buildAnalysisSheets(analyses, interactions);
      await downloadXlsx(sheets, `redepulse-historico-${brDayKey(new Date())}`);
      toast.success("Planilha gerada com uma aba por dia.");
    } catch (error) {
      toast.error("Não foi possível gerar a planilha", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Todas as análises feitas, da mais recente para a mais antiga."
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <FileSpreadsheet className="size-4" /> Baixar Excel
            </Button>
            <Button asChild>
              <Link to="/nova-analise">Nova análise</Link>
            </Button>
          </>
        }
      />


      {coordinator ? (
        <div className="max-w-sm space-y-2">
          <Label>Filtrar por líder</Label>
          <Select value={leaderFilter} onValueChange={setLeaderFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os líderes</SelectItem>
              {(leaders ?? []).map((leader) => (
                <SelectItem key={leader.id} value={leader.id}>
                  {leader.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (analyses ?? []).length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma análise encontrada"
              description="Assim que você analisar uma publicação, ela aparece aqui."
            />
          ) : (
            <div className="space-y-2">
              {(analyses ?? []).map((analysis) => (
                <Link
                  key={analysis.id}
                  to="/analise/$id"
                  params={{ id: analysis.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatDateTime(analysis.analyzed_at)} · {analysis.leaders?.name ?? "Líder"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{analysis.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {analysis.source === "demo" ? (
                      <Badge variant="outline">Demonstração</Badge>
                    ) : null}
                    {analysis.status === "completed" ? (
                      <Badge variant="secondary">
                        {analysis.identified_participants_count}/{analysis.network_size_snapshot} ·{" "}
                        {formatPercent(Number(analysis.participation_rate))}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Não concluída</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
