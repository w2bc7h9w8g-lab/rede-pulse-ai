import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Copy,
  Link as LinkIcon,
  Loader2,
  MailCheck,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — RedePulse" },
      {
        name: "description",
        content: "Gestão de campanhas, usuários, líderes e auditoria da plataforma.",
      },
    ],
  }),
  component: AdminPage,
});

type Campaign = {
  id: string;
  name: string;
  candidate_name: string | null;
  party: string | null;
  office: string | null;
  city: string | null;
  state: string | null;
  period_start: string | null;
  period_end: string | null;
  instagram_username: string | null;
  logo_url: string | null;
  status: "active" | "inactive";
  is_demo: boolean;
  created_at: string;
};
type Profile = { id: string; name: string; email: string | null; campaign_id: string | null };
type Role = { user_id: string; role: "superadmin" | "coordinator" | "leader"; campaign_id: string | null };
type Leader = {
  id: string;
  campaign_id: string;
  coordinator_id: string | null;
  user_id: string | null;
  name: string;
  invite_email: string | null;
  phone: string | null;
  status: "active" | "inactive";
};
type Invitation = {
  id: string;
  email: string;
  role: "superadmin" | "coordinator" | "leader";
  campaign_id: string | null;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};
type Audit = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  campaign_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type Coordinator = Role & { profile?: Profile | undefined };
type AdminData = {
  campaigns: Campaign[];
  profiles: Profile[];
  roles: Role[];
  leaders: Leader[];
  invitations: Invitation[];
  audits: Audit[];
};

const ADMIN_KEY = ["superadmin-control-plane"];

async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    user_id: data.user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: (metadata ?? null) as never,
  });
}

function AdminPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const isSuperadmin = session?.role === "superadmin";

  const query = useQuery({
    queryKey: ADMIN_KEY,
    enabled: isSuperadmin,
    queryFn: async (): Promise<AdminData> => {
      const [campaigns, profiles, roles, leaders, invitations, audits] = await Promise.all([
        supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,name,email,campaign_id").order("name"),
        supabase.from("user_roles").select("user_id,role,campaign_id"),
        supabase
          .from("leaders")
          .select("id,campaign_id,coordinator_id,user_id,name,invite_email,phone,status")
          .order("name"),
        supabase
          .from("user_invitations")
          .select("id,email,role,campaign_id,token,accepted_at,expires_at,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("audit_logs")
          .select("id,action,entity_type,entity_id,user_id,campaign_id,metadata,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const error =
        campaigns.error || profiles.error || roles.error || leaders.error || invitations.error || audits.error;
      if (error) throw error;
      return {
        campaigns: (campaigns.data ?? []) as Campaign[],
        profiles: (profiles.data ?? []) as Profile[],
        roles: (roles.data ?? []) as Role[],
        leaders: (leaders.data ?? []) as Leader[],
        invitations: (invitations.data ?? []) as Invitation[],
        audits: (audits.data ?? []) as Audit[],
      };
    },
  });

  const data = query.data;
  const coordinators = useMemo<Coordinator[]>(
    () =>
      (data?.roles ?? [])
        .filter((r) => r.role === "coordinator")
        .map((r) => ({ ...r, profile: data?.profiles.find((p) => p.id === r.user_id) })),
    [data],
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY });

  if (sessionLoading) {
    return (
      <div className="grid min-h-40 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Área restrita"
        description="Somente o Super Admin pode acessar a administração da plataforma."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração"
        description="Controle da plataforma: campanhas, usuários, líderes e auditoria."
      />
      {query.isLoading ? (
        <div className="grid min-h-32 place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {query.error ? (
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <p className="text-destructive">Não foi possível carregar os dados da administração.</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {data ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="leaders">Líderes</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Overview data={data} />
          </TabsContent>
          <TabsContent value="campaigns">
            <Campaigns data={data} refresh={refresh} />
          </TabsContent>
          <TabsContent value="users">
            <UsersAdmin data={data} refresh={refresh} />
          </TabsContent>
          <TabsContent value="leaders">
            <LeadersAdmin data={data} coordinators={coordinators} refresh={refresh} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLog data={data} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Confirm({
  title,
  description,
  actionLabel,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Overview({ data }: { data: AdminData }) {
  const activeCampaigns = data.campaigns.filter((c) => c.status === "active").length;
  const activeLeaders = data.leaders.filter((l) => l.status === "active").length;
  const pendingLeaders = data.leaders.filter((l) => !l.user_id).length;
  const coordinators = data.roles.filter((r) => r.role === "coordinator").length;
  const superadmins = data.roles.filter((r) => r.role === "superadmin").length;
  const pendingInvites = data.invitations.filter(
    (i) => !i.accepted_at && new Date(i.expires_at) > new Date(),
  ).length;
  const campaignsWithoutCoordinator = data.campaigns.filter(
    (c) => !data.roles.some((r) => r.role === "coordinator" && r.campaign_id === c.id),
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat title="Campanhas ativas" value={activeCampaigns} icon={Building2} />
      <Stat title="Coordenadores" value={coordinators} icon={UserCog} />
      <Stat title="Líderes ativos" value={activeLeaders} icon={Users} />
      <Stat title="Super Admins" value={superadmins} icon={ShieldCheck} />
      <Card className="sm:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-base">Pontos de atenção</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Health
            label="Campanhas cadastradas"
            ok={data.campaigns.length > 0}
            text={`${formatNumber(data.campaigns.length)} no total`}
          />
          <Health
            label="Campanhas sem coordenador"
            ok={campaignsWithoutCoordinator === 0}
            text={`${formatNumber(campaignsWithoutCoordinator)} precisam de responsável`}
          />
          <Health
            label="Líderes sem acesso"
            ok={pendingLeaders === 0}
            text={`${formatNumber(pendingLeaders)} aguardando primeiro login`}
          />
          <Health
            label="Convites pendentes"
            ok={pendingInvites === 0}
            text={`${formatNumber(pendingInvites)} aguardando aceite`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function Health({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {ok ? (
        <CheckCircle2 className="size-5 shrink-0 text-primary" />
      ) : (
        <XCircle className="size-5 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

const emptyCampaign = {
  name: "",
  candidate_name: "",
  party: "",
  office: "",
  city: "",
  state: "",
  period_start: "",
  period_end: "",
  instagram_username: "",
  logo_url: "",
  is_demo: false,
};

function Campaigns({ data, refresh }: { data: AdminData; refresh: () => Promise<unknown> }) {
  const [form, setForm] = useState(emptyCampaign);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reset = () => {
    setForm(emptyCampaign);
    setEditing(null);
  };

  function validate(): string | null {
    if (!form.name.trim()) return "Informe o nome da campanha.";
    if (form.state.trim() && !/^[A-Za-z]{2}$/.test(form.state.trim())) return "UF deve ter 2 letras (ex.: RJ).";
    if (form.period_start && form.period_end && form.period_start > form.period_end)
      return "A data final deve ser posterior à data inicial.";
    if (form.logo_url.trim() && !/^https?:\/\//i.test(form.logo_url.trim()))
      return "A URL da logo deve começar com http:// ou https://";
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        candidate_name: form.candidate_name.trim() || null,
        party: form.party.trim() || null,
        office: form.office.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        instagram_username: form.instagram_username.trim().replace(/^@/, "") || null,
        logo_url: form.logo_url.trim() || null,
        is_demo: form.is_demo,
      };
      const result = editing
        ? await supabase.from("campaigns").update(payload).eq("id", editing).select("id").single()
        : await supabase.from("campaigns").insert(payload).select("id").single();
      if (result.error) throw result.error;
      await logAdminAction(editing ? "campanha_atualizada" : "campanha_criada", "campaign", result.data.id, {
        nome: payload.name,
      });
      await refresh();
      reset();
      toast.success(editing ? "Campanha atualizada." : "Campanha criada.");
    } catch (e) {
      toast.error("Não foi possível salvar a campanha.", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Campaign) {
    const next = c.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("campaigns").update({ status: next }).eq("id", c.id);
    if (error) {
      toast.error("Não foi possível alterar a situação.", { description: error.message });
      return;
    }
    await logAdminAction(next === "active" ? "campanha_ativada" : "campanha_desativada", "campaign", c.id);
    await refresh();
    toast.success(next === "active" ? "Campanha ativada." : "Campanha desativada.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "Editar campanha" : "Nova campanha"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome da campanha">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Campanha 2026"
            />
          </Field>
          <Field label="Candidato">
            <Input
              value={form.candidate_name}
              onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
            />
          </Field>
          <Field label="Partido">
            <Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
          </Field>
          <Field label="Cargo">
            <Input value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              placeholder="RJ"
            />
          </Field>
          <Field label="Início">
            <Input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            />
          </Field>
          <Field label="Fim">
            <Input
              type="date"
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
            />
          </Field>
          <Field label="Instagram oficial">
            <Input
              value={form.instagram_username}
              onChange={(e) => setForm({ ...form, instagram_username: e.target.value })}
              placeholder="@candidato"
            />
          </Field>
          <Field label="Logo (URL)">
            <Input
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Campanha demonstração</p>
              <p className="text-xs text-muted-foreground">Dados fictícios, identificados no app.</p>
            </div>
            <Switch
              checked={form.is_demo}
              onCheckedChange={(checked) => setForm({ ...form, is_demo: checked })}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editing ? "Salvar alterações" : "Criar campanha"}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas ({data.campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.campaigns.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhuma campanha cadastrada. Crie a primeira acima.
            </p>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.candidate_name ?? "Sem candidato"} · {c.party ?? "sem partido"} ·{" "}
                      {c.city ? `${c.city}/${c.state ?? ""}` : "sem cidade"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Período: {c.period_start ?? "—"} até {c.period_end ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={c.status === "active" ? "secondary" : "outline"}>
                      {c.status === "active" ? "Ativa" : "Inativa"}
                    </Badge>
                    {c.is_demo ? <Badge>Demo</Badge> : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(c.id);
                        setForm({
                          name: c.name,
                          candidate_name: c.candidate_name ?? "",
                          party: c.party ?? "",
                          office: c.office ?? "",
                          city: c.city ?? "",
                          state: c.state ?? "",
                          period_start: c.period_start ?? "",
                          period_end: c.period_end ?? "",
                          instagram_username: c.instagram_username ?? "",
                          logo_url: c.logo_url ?? "",
                          is_demo: c.is_demo,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Editar
                    </Button>
                    <Confirm
                      title={c.status === "active" ? "Desativar campanha?" : "Ativar campanha?"}
                      description={
                        c.status === "active"
                          ? `A campanha "${c.name}" ficará inativa para a equipe. Nenhum dado é apagado.`
                          : `A campanha "${c.name}" voltará a ficar ativa para a equipe.`
                      }
                      actionLabel={c.status === "active" ? "Desativar" : "Ativar"}
                      onConfirm={() => toggle(c)}
                    >
                      <Button variant="ghost" size="sm">
                        {c.status === "active" ? "Desativar" : "Ativar"}
                      </Button>
                    </Confirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function roleLabel(role: Role["role"]) {
  return role === "superadmin" ? "Super Admin" : role === "coordinator" ? "Coordenador" : "Líder";
}

function UsersAdmin({ data, refresh }: { data: AdminData; refresh: () => Promise<unknown> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"coordinator" | "superadmin">("coordinator");
  const [campaign, setCampaign] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  async function assign(userId: string, targetRole: "coordinator" | "superadmin", campaignId: string | null) {
    setPendingUser(userId);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _user_id: userId,
      _role: targetRole,
      ...(campaignId ? { _campaign_id: campaignId } : {}),
    });
    setPendingUser(null);
    if (error) {
      toast.error("Não foi possível atualizar o papel.", { description: error.message });
      return;
    }
    await logAdminAction("papel_atribuido", "user", userId, { papel: targetRole, campanha: campaignId });
    await refresh();
    toast.success("Permissão atualizada.");
  }

  async function remove(userId: string, targetRole: "coordinator" | "superadmin") {
    const { error } = await supabase.rpc("admin_remove_role", { _user_id: userId, _role: targetRole });
    if (error) {
      toast.error("Não foi possível remover o papel.", { description: error.message });
      return;
    }
    await logAdminAction("papel_removido", "user", userId, { papel: targetRole });
    await refresh();
    toast.success("Papel removido.");
  }

  async function createInvite() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (role === "coordinator" && !campaign) {
      toast.error("Escolha a campanha do coordenador.");
      return;
    }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: row, error } = await supabase
        .from("user_invitations")
        .insert({
          email: normalized,
          role,
          campaign_id: role === "coordinator" ? campaign : null,
          invited_by: user.user?.id ?? null,
        })
        .select("id,token")
        .single();
      if (error) throw error;
      await logAdminAction("convite_criado", "invitation", row.id, { email: normalized, papel: role });
      await copyInvite(row.token);
      await refresh();
      setEmail("");
      toast.success("Convite criado e link copiado.");
    } catch (e) {
      toast.error("Não foi possível criar o convite.", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/auth?invite=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do convite copiado.");
    } catch {
      toast.info("Copie o link manualmente:", { description: url });
    }
  }

  const roleByUser = new Map<string, Role[]>();
  data.roles.forEach((r) => roleByUser.set(r.user_id, [...(roleByUser.get(r.user_id) ?? []), r]));
  const term = search.trim().toLowerCase();
  const profiles = data.profiles.filter((p) =>
    term ? `${p.name} ${p.email ?? ""}`.toLowerCase().includes(term) : true,
  );
  const campaignName = (id: string | null) =>
    id ? (data.campaigns.find((c) => c.id === id)?.name ?? "campanha removida") : "sem campanha";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar acesso administrativo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coordenacao@exemplo.com"
            />
          </Field>
          <Field label="Papel">
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coordinator">Coordenador</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {role === "coordinator" ? (
            <Field label="Campanha">
              <Select value={campaign} onValueChange={setCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a campanha" />
                </SelectTrigger>
                <SelectContent>
                  {data.campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <div className="flex items-end">
            <Button onClick={createInvite} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
              Criar convite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            O convite vale por 7 dias. O acesso é liberado quando a pessoa entra com este e-mail.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites ({data.invitations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invitations.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nenhum convite criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.invitations.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                return (
                  <div
                    key={i.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(i.role)} · {campaignName(i.campaign_id)} · criado em{" "}
                        {formatDateTime(i.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={i.accepted_at ? "secondary" : expired ? "outline" : "default"}>
                        {i.accepted_at ? "Aceito" : expired ? "Expirado" : "Pendente"}
                      </Badge>
                      {!i.accepted_at && !expired ? (
                        <Button variant="ghost" size="sm" onClick={() => copyInvite(i.token)}>
                          <Copy className="size-3" />
                          Copiar link
                        </Button>
                      ) : (
                        <MailCheck className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Usuários ({data.profiles.length})</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
          />
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => {
                const roles = roleByUser.get(p.id) ?? [];
                const isCoordinator = roles.some((r) => r.role === "coordinator");
                return (
                  <div key={p.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{p.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.email ?? "sem e-mail"} · {campaignName(p.campaign_id)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roles.length === 0 ? (
                          <Badge variant="outline">Sem papel</Badge>
                        ) : (
                          roles.map((r) => (
                            <Badge key={r.role} variant={r.role === "superadmin" ? "secondary" : "outline"}>
                              {roleLabel(r.role)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label="Tornar coordenador da campanha">
                        <Select
                          value=""
                          onValueChange={(campaignId) => assign(p.id, "coordinator", campaignId)}
                          disabled={pendingUser === p.id || data.campaigns.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha a campanha" />
                          </SelectTrigger>
                          <SelectContent>
                            {data.campaigns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {isCoordinator ? (
                        <Confirm
                          title="Remover papel de coordenador?"
                          description={`${p.name || p.email} perderá o acesso de coordenação. Os dados da campanha permanecem.`}
                          actionLabel="Remover"
                          onConfirm={() => remove(p.id, "coordinator")}
                        >
                          <Button variant="outline" size="sm">
                            Remover coordenação
                          </Button>
                        </Confirm>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadersAdmin({
  data,
  coordinators,
  refresh,
}: {
  data: AdminData;
  coordinators: Coordinator[];
  refresh: () => Promise<unknown>;
}) {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", invite_email: "", phone: "" });

  const term = filter.trim().toLowerCase();
  const filtered = data.leaders.filter((l) => {
    const matchesText = term ? `${l.name} ${l.invite_email ?? ""}`.toLowerCase().includes(term) : true;
    const matchesStatus = statusFilter === "all" ? true : l.status === statusFilter;
    const matchesCampaign = campaignFilter === "all" ? true : l.campaign_id === campaignFilter;
    return matchesText && matchesStatus && matchesCampaign;
  });

  async function assign(l: Leader, campaignId: string, coordinatorId: string) {
    setSaving(l.id);
    const { error } = await supabase.rpc("admin_assign_leader", {
      _leader_id: l.id,
      _campaign_id: campaignId,
      ...(coordinatorId ? { _coordinator_id: coordinatorId } : {}),
      ...(l.user_id ? { _user_id: l.user_id } : {}),
    });
    setSaving(null);
    if (error) {
      toast.error("Não foi possível transferir o líder.", { description: error.message });
      return;
    }
    await logAdminAction("lider_transferido", "leader", l.id, {
      campanha: campaignId,
      coordenador: coordinatorId || null,
    });
    await refresh();
    toast.success("Líder atualizado.");
  }

  async function toggle(l: Leader) {
    const next = l.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("leaders").update({ status: next }).eq("id", l.id);
    if (error) {
      toast.error("Não foi possível atualizar o líder.", { description: error.message });
      return;
    }
    await logAdminAction(next === "active" ? "lider_ativado" : "lider_desativado", "leader", l.id);
    await refresh();
    toast.success(next === "active" ? "Líder ativado." : "Líder desativado.");
  }

  async function saveEdit(l: Leader) {
    if (!editForm.name.trim()) {
      toast.error("Informe o nome do líder.");
      return;
    }
    if (editForm.invite_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.invite_email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSaving(l.id);
    const { error } = await supabase
      .from("leaders")
      .update({
        name: editForm.name.trim(),
        invite_email: editForm.invite_email.trim().toLowerCase() || null,
        phone: editForm.phone.trim() || null,
      })
      .eq("id", l.id);
    setSaving(null);
    if (error) {
      toast.error("Não foi possível salvar o líder.", { description: error.message });
      return;
    }
    await logAdminAction("lider_editado", "leader", l.id);
    await refresh();
    setEditing(null);
    toast.success("Dados do líder atualizados.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestão de líderes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="active">Somente ativos</SelectItem>
              <SelectItem value="inactive">Somente inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {data.campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum líder encontrado com esses filtros.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((l) => {
                const campaign = data.campaigns.find((c) => c.id === l.campaign_id);
                const current = coordinators.find((c) => c.user_id === l.coordinator_id);
                const isEditing = editing === l.id;
                return (
                  <div key={l.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.invite_email ?? "sem e-mail"} · {l.phone ?? "sem telefone"} ·{" "}
                          {campaign?.name ?? "sem campanha"} ·{" "}
                          {l.user_id ? "acesso ativo" : "aguardando primeiro login"}
                        </p>
                        {current ? (
                          <p className="text-xs text-muted-foreground">
                            Responsável: {current.profile?.name ?? current.profile?.email ?? "coordenador"}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={l.status === "active" ? "secondary" : "outline"}>
                          {l.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(isEditing ? null : l.id);
                            setEditForm({
                              name: l.name,
                              invite_email: l.invite_email ?? "",
                              phone: l.phone ?? "",
                            });
                          }}
                        >
                          {isEditing ? "Fechar" : "Editar"}
                        </Button>
                        <Confirm
                          title={l.status === "active" ? "Desativar líder?" : "Ativar líder?"}
                          description={
                            l.status === "active"
                              ? `${l.name} deixa de aparecer como ativo e perde o uso da plataforma. Os dados são mantidos.`
                              : `${l.name} volta a ficar ativo na campanha.`
                          }
                          actionLabel={l.status === "active" ? "Desativar" : "Ativar"}
                          onConfirm={() => toggle(l)}
                        >
                          <Button variant="ghost" size="sm">
                            {l.status === "active" ? "Desativar" : "Ativar"}
                          </Button>
                        </Confirm>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Nome">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </Field>
                        <Field label="E-mail de acesso">
                          <Input
                            type="email"
                            value={editForm.invite_email}
                            onChange={(e) => setEditForm({ ...editForm, invite_email: e.target.value })}
                          />
                        </Field>
                        <Field label="WhatsApp">
                          <Input
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          />
                        </Field>
                        <div className="sm:col-span-3">
                          <Button size="sm" onClick={() => saveEdit(l)} disabled={saving === l.id}>
                            {saving === l.id ? <Loader2 className="size-4 animate-spin" /> : null}
                            Salvar dados
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Campanha">
                        <Select
                          value={l.campaign_id}
                          onValueChange={(campaignId) => assign(l, campaignId, "")}
                          disabled={saving === l.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {data.campaigns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Coordenador responsável">
                        <Select
                          value={l.coordinator_id ?? "none"}
                          onValueChange={(coordinatorId) =>
                            assign(l, l.campaign_id, coordinatorId === "none" ? "" : coordinatorId)
                          }
                          disabled={saving === l.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem coordenador</SelectItem>
                            {coordinators
                              .filter((c) => c.campaign_id === l.campaign_id)
                              .map((c) => (
                                <SelectItem key={c.user_id} value={c.user_id}>
                                  {c.profile?.name ?? c.profile?.email ?? "Coordenador"}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trocar a campanha remove o coordenador anterior para evitar acesso entre campanhas.
                    </p>
                    {saving === l.id ? (
                      <p className="text-xs text-muted-foreground">Salvando alterações…</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLog({ data }: { data: AdminData }) {
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");
  const entities = Array.from(new Set(data.audits.map((a) => a.entity_type ?? "evento")));
  const nameByUser = new Map(data.profiles.map((p) => [p.id, p.name || p.email || p.id]));
  const campaignById = new Map(data.campaigns.map((c) => [c.id, c.name]));
  const term = search.trim().toLowerCase();
  const rows = data.audits.filter((a) => {
    const matchesEntity = entity === "all" ? true : (a.entity_type ?? "evento") === entity;
    const matchesText = term
      ? `${a.action} ${a.entity_type ?? ""} ${nameByUser.get(a.user_id ?? "") ?? ""}`
          .toLowerCase()
          .includes(term)
      : true;
    return matchesEntity && matchesText;
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Auditoria ({rows.length})</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ação ou usuário"
          />
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="divide-y">
            {rows.map((a) => (
              <div key={a.id} className="flex gap-3 py-3">
                <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.entity_type ?? "evento"} · {formatDateTime(a.created_at)} ·{" "}
                    {nameByUser.get(a.user_id ?? "") ?? "sistema"}
                    {a.campaign_id ? ` · ${campaignById.get(a.campaign_id) ?? "campanha"}` : ""}
                  </p>
                  {a.metadata ? (
                    <pre className="mt-1 overflow-auto text-[11px] text-muted-foreground">
                      {JSON.stringify(a.metadata)}
                    </pre>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
