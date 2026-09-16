import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Copy, FileSpreadsheet, Loader2, UserPlus, UsersRound } from "lucide-react";
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
import { brDayKey, formatNumber, formatPercent } from "@/lib/format";
import { downloadXlsx } from "@/lib/excel";
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

const ATTENTION_DAYS = 7;
const LOW_PARTICIPATION_RATE = 20;

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function TeamPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const coordinator = isCoordinator(session);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["equipe"],
    queryFn: async () => {
      const [{ data: leaders, error }, { data: members }, analyses] = await Promise.all([
        supabase.from("leaders").select("id, name, invite_email, phone, status, user_id").order("name"),
        supabase.from("network_members").select("id, leader_id").eq("active", true),
        fetchAnalyses(),
      ]);
      if (error) throw error;
      return { leaders: leaders ?? [], members: members ?? [], analyses };
    },
    enabled: coordinator,
  });

  if (!coordinator) {
    return <EmptyState title="Área da coordenação" description="Esta página é exclusiva de quem coordena a campanha." />;
  }

  const stats = (leaderId: string) => {
    const list = (data?.analyses ?? []).filter((a) => a.leader_id === leaderId && a.status === "completed");
    const avg = list.length ? list.reduce((s, a) => s + Number(a.participation_rate), 0) / list.length : 0;
    return { network: (data?.members ?? []).filter((m) => m.leader_id === leaderId).length, analyses: list.length, avg };
  };

  const attention = (data?.leaders ?? []).map((leader) => {
    const leaderAnalyses = (data?.analyses ?? []).filter((a) => a.leader_id === leader.id && a.status === "completed").sort((a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime());
    const latest = leaderAnalyses[0];
    const rate = leaderAnalyses.length ? leaderAnalyses.reduce((sum, a) => sum + Number(a.participation_rate), 0) / leaderAnalyses.length : null;
    const network = (data?.members ?? []).filter((m) => m.leader_id === leader.id).length;
    const age = daysSince(latest?.analyzed_at);
    const reasons: string[] = [];
    if (network === 0) reasons.push("sem pessoas cadastradas");
    if (!latest || (age !== null && age >= ATTENTION_DAYS)) reasons.push(latest ? `sem análise há ${age} dias` : "sem análise");
    if (rate !== null && rate < LOW_PARTICIPATION_RATE) reasons.push(`média abaixo de ${LOW_PARTICIPATION_RATE}%`);
    return { ...leader, network, latest, rate, reasons };
  }).filter((leader) => leader.reasons.length > 0).sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name));

  async function createInvitation(leaderId: string, copy = true) {
    setInvitingId(leaderId);
    try {
      const { data: invitation, error } = await supabase.rpc("create_leader_invitation", { _leader_id: leaderId }).single();
      if (error) throw error;
      const token = invitation?.token as string | undefined;
      if (!token) throw new Error("O convite foi criado, mas não recebemos o token.");
      const link = `${window.location.origin}/auth?invite=${encodeURIComponent(token)}`;
      setInviteLinks((current) => ({ ...current, [leaderId]: link }));
      if (copy) {
        await navigator.clipboard.writeText(link);
        toast.success("Convite copiado!", { description: "Envie este link ao líder para ele criar a senha e entrar na rede." });
      } else toast.success("Novo convite gerado.", { description: "O convite anterior foi encerrado." });
    } catch (error) {
      toast.error("Não foi possível gerar o convite", { description: error instanceof Error ? error.message : undefined });
    } finally { setInvitingId(null); }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.campaign?.id) return;
    setSaving(true);
    try {
      const { data: leader, error } = await supabase.from("leaders").insert({ campaign_id: session.campaign.id, name: name.trim(), invite_email: email.trim().toLowerCase() || null, phone: phone.trim() || null }).select("id").single();
      if (error) throw error;
      setName(""); setEmail(""); setPhone("");
      await queryClient.invalidateQueries({ queryKey: ["equipe"] });
      if (email.trim()) await createInvitation(leader.id, true);
      else toast.success("Líder cadastrado!", { description: "Adicione um e-mail depois para liberar o convite de acesso." });
    } catch (error) {
      toast.error("Não foi possível cadastrar", { description: error instanceof Error ? error.message : undefined });
    } finally { setSaving(false); }
  }

  async function toggleStatus(id: string, status: string) {
    const next = (status === "active" ? "inactive" : "active") as "active" | "inactive";
    const { error } = await supabase.from("leaders").update({ status: next }).eq("id", id);
    if (error) { toast.error("Não foi possível atualizar."); return; }
    await queryClient.invalidateQueries({ queryKey: ["equipe"] });
  }

  async function handleExportTeam() {
    const ranking = [...(data?.leaders ?? [])].sort((a, b) => stats(b.id).avg - stats(a.id).avg);
    if (!ranking.length) { toast.error("Não há líderes para exportar."); return; }
    try {
      const rows: (string | number)[][] = [["Líder", "E-mail", "WhatsApp", "Situação", "Acesso", "Tamanho da rede", "Análises", "Participação média"], ...ranking.map((leader) => { const s = stats(leader.id); return [leader.name, leader.invite_email ?? "", leader.phone ?? "", leader.status === "active" ? "Ativo" : "Inativo", leader.user_id ? "Acesso ativo" : "Aguardando primeiro acesso", s.network, s.analyses, formatPercent(s.avg)]; })];
      await downloadXlsx([{ name: "Resumo", rows }], `redepulse-equipe-${brDayKey(new Date())}`);
      toast.success("Planilha da equipe gerada.");
    } catch (error) { toast.error("Não foi possível gerar a planilha", { description: error instanceof Error ? error.message : undefined }); }
  }

  const ranking = [...(data?.leaders ?? [])].sort((a, b) => stats(b.id).avg - stats(a.id).avg);
  const noAnalysis = attention.filter((x) => x.reasons.some((r) => r.includes("sem análise"))).length;
  const lowParticipation = attention.filter((x) => x.rate !== null && x.rate < LOW_PARTICIPATION_RATE).length;
  const noNetwork = attention.filter((x) => x.network === 0).length;

  return (
    <>
      <PageHeader title="Minha equipe" description="Cadastre seus líderes e envie um convite para cada um criar o próprio acesso." actions={<Button variant="outline" onClick={handleExportTeam}><FileSpreadsheet className="size-4" /> Baixar Excel</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Líderes ativos</p><p className="mt-1 text-2xl font-semibold">{formatNumber(data?.leaders.length ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Pessoas nas redes</p><p className="mt-1 text-2xl font-semibold">{formatNumber(data?.members.length ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Precisam de atenção</p><p className="mt-1 text-2xl font-semibold">{formatNumber(attention.length)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Análises concluídas</p><p className="mt-1 text-2xl font-semibold">{formatNumber((data?.analyses ?? []).filter((a) => a.status === "completed").length)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Quem precisa de atenção?</CardTitle><p className="mt-1 text-sm text-muted-foreground">Pendências operacionais para você acompanhar.</p></div><Badge variant={attention.length ? "destructive" : "secondary"}>{attention.length}</Badge></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Sem análise há 7+ dias</p><p className="mt-1 text-xl font-semibold">{noAnalysis}</p></div><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Média abaixo de 20%</p><p className="mt-1 text-xl font-semibold">{lowParticipation}</p></div><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Sem rede cadastrada</p><p className="mt-1 text-xl font-semibold">{noNetwork}</p></div></div>
          {attention.length === 0 ? <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Nenhuma pendência identificada nos critérios atuais.</div> : <div className="space-y-2">{attention.map((leader) => <Link key={leader.id} to="/equipe/$leaderId" params={{ leaderId: leader.id }} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted"><span className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><AlertTriangle className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{leader.name}</span><span className="block truncate text-xs text-muted-foreground">{leader.reasons.join(" · ")}</span></span></span><span className="flex shrink-0 items-center gap-2"><Badge variant="outline">{leader.network} na rede</Badge>{leader.rate !== null ? <Badge variant="secondary">{formatPercent(leader.rate)}</Badge> : null}</span></Link>)}</div>}
        </CardContent>
      </Card>

      <Card className="max-w-2xl"><CardHeader><CardTitle className="text-base">Cadastrar líder</CardTitle></CardHeader><CardContent><form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-3"><Label htmlFor="nome-lider">Nome do líder</Label><Input id="nome-lider" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana Souza" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="email-lider">E-mail de acesso</Label><Input id="email-lider" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@exemplo.com" /></div><div className="space-y-2"><Label htmlFor="tel-lider">WhatsApp (opcional)</Label><Input id="tel-lider" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" /></div><div className="sm:col-span-3"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Cadastrar líder</Button></div></form><p className="mt-3 text-xs text-muted-foreground">Se informar o e-mail, o RedePulse gera o convite na hora e você pode copiar o link para enviar ao líder.</p></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Líderes ({data?.leaders.length ?? 0})</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : ranking.length === 0 ? <EmptyState icon={UsersRound} title="Nenhum líder cadastrado" description="Cadastre o primeiro líder para começar a organizar as redes." /> : <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">{ranking.map((leader) => { const s = stats(leader.id); const inviting = invitingId === leader.id; const link = inviteLinks[leader.id]; return <div key={leader.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><Link to="/equipe/$leaderId" params={{ leaderId: leader.id }} className="truncate text-sm font-medium hover:underline">{leader.name}</Link><p className="truncate text-xs text-muted-foreground">{leader.invite_email ?? "sem e-mail"} · {leader.user_id ? "acesso ativo" : "aguardando primeiro acesso"}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{formatNumber(s.network)} na rede</Badge><Badge variant="outline">{s.analyses} análises</Badge><Badge variant="secondary">{formatPercent(s.avg)}</Badge>{leader.status !== "active" ? <Badge>Inativo</Badge> : null}{!leader.user_id && leader.invite_email ? link ? <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Convite copiado!"))}><Copy className="size-4" /> Copiar convite</Button> : <Button variant="outline" size="sm" disabled={inviting} onClick={() => createInvitation(leader.id)}>{inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Gerar convite</Button> : null}{!leader.user_id && leader.invite_email && link ? <Button variant="ghost" size="sm" disabled={inviting} onClick={() => createInvitation(leader.id, false)}>{inviting ? <Loader2 className="size-4 animate-spin" /> : null} Novo link</Button> : null}<Button variant="ghost" size="sm" onClick={() => toggleStatus(leader.id, leader.status)}>{leader.status === "active" ? "Desativar" : "Reativar"}</Button></div></div>; })}</div>}</CardContent></Card>
    </>
  );
}
