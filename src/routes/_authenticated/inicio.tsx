import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, ClipboardList, Clock3, Sparkles, TrendingUp, UserCheck, Users, UsersRound } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import { DemoNotice, PrivacyNotice } from "@/components/app/DemoNotice";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { formatDate, formatNumber, formatPercent, brDayKey } from "@/lib/format";
import { fetchAnalyses } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — RedePulse" },
      { name: "description", content: "Resumo da participação da sua rede nas publicações." },
      { property: "og:title", content: "Início — RedePulse" },
      { property: "og:description", content: "Resumo da participação da sua rede." },
    ],
  }),
  component: HomePage,
});

const STEPS = [
  { title: "Cadastre sua rede", text: "Adicione os @ das pessoas que fazem parte da sua rede." },
  { title: "Cole uma publicação", text: "Copie o link do post ou reel do Instagram da campanha." },
  { title: "Analise", text: "Clique em Analisar publicação e aguarde alguns segundos." },
  { title: "Veja quem participou", text: "A lista mostra quem comentou ou mencionou." },
];

const ATTENTION_DAYS = 7;
const LOW_PARTICIPATION_RATE = 20;

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function useHomeData(leaderId: string | null, coordinator: boolean) {
  return useQuery({
    queryKey: ["home", leaderId, coordinator],
    queryFn: async () => {
      const analyses = await fetchAnalyses(coordinator ? {} : { leaderId });
      const membersQuery = supabase.from("network_members").select("id, leader_id", { count: "exact" }).eq("active", true);
      const { data: members } = coordinator ? await membersQuery : await membersQuery.eq("leader_id", leaderId ?? "");
      const { data: leaders } = await supabase.from("leaders").select("id, name, status").eq("status", "active");
      return { analyses, members: members ?? [], leaders: leaders ?? [] };
    },
  });
}

function HomePage() {
  const { data: session } = useSession();
  const coordinator = isCoordinator(session);
  const { data, isLoading } = useHomeData(session?.leaderId ?? null, coordinator);
  const analyses = data?.analyses ?? [];
  const completed = analyses.filter((a) => a.status === "completed");
  const avgRate = completed.length ? completed.reduce((s, a) => s + Number(a.participation_rate), 0) / completed.length : 0;

  const evolution = (() => {
    const byDay = new Map<string, { sum: number; count: number }>();
    for (const analysis of completed) {
      const key = brDayKey(analysis.analyzed_at);
      const entry = byDay.get(key) ?? { sum: 0, count: 0 };
      entry.sum += Number(analysis.participation_rate);
      entry.count += 1;
      byDay.set(key, entry);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, value]) => ({
      dia: day.slice(5).split("-").reverse().join("/"),
      participacao: Number((value.sum / value.count).toFixed(1)),
    }));
  })();

  const ranking = (() => {
    const map = new Map<string, { name: string; count: number; sum: number; participants: number }>();
    for (const analysis of completed) {
      const entry = map.get(analysis.leader_id) ?? { name: analysis.leaders?.name ?? "Líder", count: 0, sum: 0, participants: 0 };
      entry.count += 1;
      entry.sum += Number(analysis.participation_rate);
      entry.participants += analysis.identified_participants_count;
      map.set(analysis.leader_id, entry);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v, avg: v.count ? v.sum / v.count : 0 })).sort((a, b) => b.avg - a.avg);
  })();

  const attention = coordinator ? (data?.leaders ?? []).map((leader) => {
    const leaderAnalyses = completed.filter((a) => a.leader_id === leader.id).sort((a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime());
    const latest = leaderAnalyses[0];
    const rate = leaderAnalyses.length ? leaderAnalyses.reduce((sum, a) => sum + Number(a.participation_rate), 0) / leaderAnalyses.length : null;
    const network = (data?.members ?? []).filter((m) => m.leader_id === leader.id).length;
    const age = daysSince(latest?.analyzed_at);
    const reasons: string[] = [];
    if (network === 0) reasons.push("sem pessoas cadastradas");
    if (!latest || (age !== null && age >= ATTENTION_DAYS)) reasons.push(latest ? `sem análise há ${age} dias` : "sem análise");
    if (rate !== null && rate < LOW_PARTICIPATION_RATE) reasons.push(`média abaixo de ${LOW_PARTICIPATION_RATE}%`);
    return { ...leader, network, latest, rate, reasons };
  }).filter((leader) => leader.reasons.length > 0).sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name)) : [];

  return (
    <>
      <PageHeader title={`Olá, ${session?.name?.split(" ")[0] ?? ""}`} description={coordinator ? "Acompanhe a participação identificada de toda a campanha e veja onde há pendências operacionais." : "Analise uma publicação e veja quem da sua rede participou."} actions={<Button asChild size="lg"><Link to="/nova-analise"><Sparkles className="size-4" /> Nova análise</Link></Button>} />
      {session?.campaign?.is_demo ? <DemoNotice /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coordinator ? <StatCard label="Líderes ativos" value={formatNumber(data?.leaders.length ?? 0)} icon={UsersRound} /> : null}
        <StatCard label={coordinator ? "Pessoas nas redes" : "Tamanho da sua rede"} value={formatNumber(data?.members.length ?? 0)} icon={Users} />
        <StatCard label="Participação média" value={formatPercent(avgRate)} hint="identificada por comentários e menções" icon={TrendingUp} />
        <StatCard label="Análises feitas" value={formatNumber(analyses.length)} icon={BarChart3} />
      </div>

      {coordinator ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle className="text-base">Quem precisa de atenção?</CardTitle><p className="mt-1 text-sm text-muted-foreground">Alertas operacionais baseados no uso recente da plataforma.</p></div>
            <Badge variant={attention.length ? "destructive" : "secondary"}>{attention.length} {attention.length === 1 ? "líder" : "líderes"}</Badge>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4"><UserCheck className="size-5 text-muted-foreground" /><div><p className="text-sm font-medium">Nenhuma pendência identificada</p><p className="text-xs text-muted-foreground">Todos os líderes ativos têm rede cadastrada, análise recente ou média de participação acima do limite configurado.</p></div></div>
            ) : (
              <div className="space-y-2">
                {attention.slice(0, 8).map((leader) => (
                  <Link key={leader.id} to="/equipe/$leaderId" params={{ leaderId: leader.id }} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted">
                    <span className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><AlertTriangle className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{leader.name}</span><span className="block truncate text-xs text-muted-foreground">{leader.reasons.join(" · ")}</span></span></span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>{leader.network} na rede</span>{leader.rate !== null ? <Badge variant="secondary">{formatPercent(leader.rate)}</Badge> : null}<ArrowRight className="size-4" /></span>
                  </Link>
                ))}
                {attention.length > 8 ? <Button asChild variant="ghost" size="sm" className="mt-2"><Link to="/equipe">Ver todos os {attention.length} líderes <ArrowRight className="size-4" /></Link></Button> : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!coordinator && (data?.members.length ?? 0) === 0 ? <Card><CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{STEPS.map((step, index) => <div key={step.title} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><div><p className="text-sm font-medium">{step.title}</p><p className="text-sm text-muted-foreground">{step.text}</p></div></div>)}<div className="sm:col-span-2"><Button asChild variant="outline"><Link to="/minha-rede">Começar cadastrando minha rede <ArrowRight className="size-4" /></Link></Button></div></CardContent></Card> : null}

      {coordinator && attention.length > 0 ? <Card><CardHeader><CardTitle className="text-base">Resumo operacional</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Sem análise há 7+ dias</p><p className="mt-1 text-2xl font-semibold">{attention.filter((x) => x.reasons.some((r) => r.includes("sem análise"))).length}</p></div><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Média abaixo de 20%</p><p className="mt-1 text-2xl font-semibold">{attention.filter((x) => x.rate !== null && x.rate < LOW_PARTICIPATION_RATE).length}</p></div><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Sem rede cadastrada</p><p className="mt-1 text-2xl font-semibold">{attention.filter((x) => x.network === 0).length}</p></div></CardContent></Card> : null}

      {evolution.length > 1 ? <Card><CardHeader><CardTitle className="text-base">Evolução da participação identificada</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolution} margin={{ left: -20, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="dia" fontSize={12} stroke="var(--color-muted-foreground)" /><YAxis fontSize={12} stroke="var(--color-muted-foreground)" unit="%" /><Tooltip formatter={(value) => [`${value}%`, "Participação"]} /><Line type="monotone" dataKey="participacao" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></CardContent></Card> : null}

      {coordinator && ranking.length > 0 ? <Card><CardHeader><CardTitle className="text-base">Participação por líder</CardTitle></CardHeader><CardContent className="space-y-2">{ranking.map((row, index) => <Link key={row.id} to="/equipe/$leaderId" params={{ leaderId: row.id }} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"><span className="flex min-w-0 items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="truncate text-sm font-medium">{row.name}</span></span><span className="flex shrink-0 items-center gap-3 text-sm"><span className="text-muted-foreground">{row.count} análises</span><Badge variant="secondary">{formatPercent(row.avg)}</Badge></span></Link>)}</CardContent></Card> : null}

      {coordinator && data?.leaders.length ? <Card><CardHeader><CardTitle className="text-base">Última atividade da equipe</CardTitle></CardHeader><CardContent className="space-y-2">{[...completed].sort((a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()).slice(0, 6).map((analysis) => <Link key={analysis.id} to="/analise/$id" params={{ id: analysis.id }} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted"><span className="flex min-w-0 items-center gap-3"><Clock3 className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{analysis.leaders?.name ?? "Líder"}</span><span className="block truncate text-xs text-muted-foreground">{formatDate(analysis.analyzed_at)}</span></span></span><Badge variant="secondary">{analysis.identified_participants_count} participantes · {formatPercent(Number(analysis.participation_rate))}</Badge></Link>)}</CardContent></Card> : null}

      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Análises recentes</CardTitle><Button asChild variant="ghost" size="sm"><Link to="/historico">Ver todas</Link></Button></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : analyses.length === 0 ? <EmptyState icon={ClipboardList} title="Nenhuma análise ainda" description="Cole o link de uma publicação para descobrir quem da rede participou." action={<Button asChild><Link to="/nova-analise">Fazer primeira análise</Link></Button>} /> : <div className="space-y-2">{analyses.slice(0, 6).map((analysis) => <Link key={analysis.id} to="/analise/$id" params={{ id: analysis.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"><div className="min-w-0"><p className="truncate text-sm font-medium">{analysis.leaders?.name ?? "Líder"} · {formatDate(analysis.analyzed_at)}</p><p className="truncate text-xs text-muted-foreground">{analysis.url}</p></div>{analysis.status === "completed" ? <Badge variant="secondary" className="shrink-0"><UserCheck className="size-3" />{analysis.identified_participants_count} de {analysis.network_size_snapshot} · {formatPercent(Number(analysis.participation_rate))}</Badge> : <Badge variant="destructive" className="shrink-0">Não concluída</Badge>}</Link>)}</div>}</CardContent></Card>
      <PrivacyNotice />
    </>
  );
}
