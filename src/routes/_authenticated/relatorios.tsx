import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { buildAnalysisSheets, fetchAnalyses, fetchInteractions } from "@/lib/reports";
import { downloadCsv, downloadXlsx } from "@/lib/excel";
import { brDayKey, formatNumber, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — RedePulse" },
      {
        name: "description",
        content: "Exporte em Excel a participação da rede, com uma aba por dia.",
      },
      { property: "og:title", content: "Relatórios — RedePulse" },
      { property: "og:description", content: "Exporte a participação da rede em Excel." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: session } = useSession();
  const coordinator = isCoordinator(session);
  const [leaderFilter, setLeaderFilter] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: leaders } = useQuery({
    queryKey: ["leaders-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leaders").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: coordinator,
  });

  const filters = {
    leaderId: coordinator ? (leaderFilter === "todos" ? null : leaderFilter) : session?.leaderId,
    from: from || null,
    to: to || null,
  };

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["relatorios", filters.leaderId, filters.from, filters.to],
    queryFn: () => fetchAnalyses(filters),
  });

  const stats = useMemo(() => {
    const list = (analyses ?? []).filter((a) => a.status === "completed");
    const days = new Set(list.map((a) => brDayKey(a.analyzed_at)));
    const avg =
      list.length > 0
        ? list.reduce((s, a) => s + Number(a.participation_rate), 0) / list.length
        : 0;
    return {
      analyses: list.length,
      days: days.size,
      participants: list.reduce((s, a) => s + a.identified_participants_count, 0),
      avg,
    };
  }, [analyses]);

  const nenhumDado = !isLoading && (analyses ?? []).length === 0;

  async function handleExcel() {
    if (!analyses || analyses.length === 0) {
      toast.error("Não há análises no período selecionado.");
      return;
    }
    setExporting(true);
    try {
      const interactions = await fetchInteractions(analyses.map((a) => a.id));
      const sheets = buildAnalysisSheets(analyses, interactions);
      await downloadXlsx(sheets, `redepulse-relatorio-${brDayKey(new Date())}`);
      toast.success("Planilha gerada com uma aba por dia.");
    } catch (error) {
      toast.error("Não foi possível gerar a planilha", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleCsv() {
    if (!analyses || analyses.length === 0) {
      toast.error("Não há análises no período selecionado.");
      return;
    }
    const interactions = await fetchInteractions(analyses.map((a) => a.id));
    const sheets = buildAnalysisSheets(analyses, interactions);
    const rows = sheets.slice(1).flatMap((sheet, index) => (index === 0 ? sheet.rows : sheet.rows.slice(1)));
    downloadCsv(rows, `redepulse-relatorio-${brDayKey(new Date())}`);
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Escolha o período e baixe a planilha. O Excel vem com um resumo e uma aba para cada dia."
        actions={
          <>
            <Button variant="outline" onClick={handleCsv} disabled={isLoading || nenhumDado}>
              <Download className="size-4" /> CSV
            </Button>
            <Button onClick={handleExcel} disabled={exporting || isLoading || nenhumDado}>
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Baixar Excel
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="de">De</Label>
            <Input id="de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ate">Até</Label>
            <Input id="ate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {coordinator ? (
            <div className="space-y-2">
              <Label>Líder</Label>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Análises no período" value={formatNumber(stats.analyses)} />
        <StatCard label="Dias com análise" value={formatNumber(stats.days)} />
        <StatCard label="Participações identificadas" value={formatNumber(stats.participants)} />
        <StatCard label="Participação média" value={formatPercent(stats.avg)} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

      <p className="text-xs text-muted-foreground">
        A planilha inclui: dia, líder, publicação, participante, tipo de interação, texto do
        comentário, tamanho da rede e percentual de participação identificada.
      </p>
    </>
  );
}
