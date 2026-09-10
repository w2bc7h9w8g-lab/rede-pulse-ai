import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PrivacyNotice } from "@/components/app/DemoNotice";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { normalizeUsername, isValidUsername, parseUsernameList } from "@/lib/usernames";
import { downloadCsv, downloadXlsx } from "@/lib/excel";
import { buildNetworkSheet } from "@/lib/reports";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/minha-rede")({
  head: () => ({
    meta: [
      { title: "Minha rede — RedePulse" },
      { name: "description", content: "Cadastre e organize os perfis da sua rede de liderados." },
      { property: "og:title", content: "Minha rede — RedePulse" },
      { property: "og:description", content: "Cadastre os perfis da sua rede." },
    ],
  }),
  component: NetworkPage,
});

function NetworkPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const coordinator = isCoordinator(session);
  const [leaderId, setLeaderId] = useState<string>("");
  const [single, setSingle] = useState("");
  const [singleName, setSingleName] = useState("");
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: leaders } = useQuery({
    queryKey: ["leaders-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaders")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (session?.leaderId) setLeaderId(session.leaderId);
    else if (!leaderId && leaders?.[0]) setLeaderId(leaders[0].id);
  }, [session?.leaderId, leaders, leaderId]);

  const { data: members, isLoading } = useQuery({
    queryKey: ["network", leaderId],
    enabled: Boolean(leaderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_members")
        .select("id, instagram_username, display_name, active, created_at")
        .eq("leader_id", leaderId)
        .order("instagram_username");
      if (error) throw error;
      return data ?? [];
    },
  });

  const leaderName =
    session?.leaderName ?? leaders?.find((l) => l.id === leaderId)?.name ?? "Líder";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members ?? [];
    return (members ?? []).filter(
      (m) =>
        m.instagram_username.includes(term) ||
        (m.display_name ?? "").toLowerCase().includes(term),
    );
  }, [members, search]);

  const preview = bulk.trim() ? parseUsernameList(bulk) : null;

  async function insertUsernames(rows: Array<{ username: string; name?: string | null }>) {
    if (!leaderId || !session?.campaign?.id) {
      toast.error("Selecione uma rede antes de adicionar pessoas.");
      return;
    }
    setSaving(true);
    try {
      const payload = rows.map((row) => ({
        campaign_id: session.campaign!.id,
        leader_id: leaderId,
        instagram_username: row.username,
        display_name: row.name?.trim() || null,
      }));
      const { data, error } = await supabase
        .from("network_members")
        .upsert(payload, { onConflict: "leader_id,instagram_username", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      const added = data?.length ?? 0;
      const skipped = rows.length - added;
      toast.success(
        added === 0
          ? "Esses perfis já estavam na sua rede."
          : `${added} perfil(is) adicionado(s)${skipped > 0 ? `, ${skipped} já existia(m)` : ""}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["network", leaderId] });
      setSingle("");
      setSingleName("");
      setBulk("");
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSingle(event: React.FormEvent) {
    event.preventDefault();
    const username = normalizeUsername(single);
    if (!isValidUsername(username)) {
      toast.error("Esse @ não parece válido.", {
        description: "Use apenas letras, números, ponto e underline.",
      });
      return;
    }
    await insertUsernames([{ username, name: singleName }]);
  }

  async function handleBulk(event: React.FormEvent) {
    event.preventDefault();
    if (!preview || preview.valid.length === 0) {
      toast.error("Cole ao menos um @ válido.");
      return;
    }
    await insertUsernames(preview.valid.map((username) => ({ username })));
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBulk((current) => (current ? `${current}\n${text}` : text));
    event.target.value = "";
    toast.success("Arquivo lido! Confira a lista antes de salvar.");
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("network_members").update({ active }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["network", leaderId] });
  }

  async function removeMember(id: string) {
    const { error } = await supabase.from("network_members").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Perfil removido da rede.");
    await queryClient.invalidateQueries({ queryKey: ["network", leaderId] });
  }

  async function exportExcel() {
    try {
      await downloadXlsx([buildNetworkSheet(members ?? [], leaderName)], `rede-${leaderName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    }
  }

  function exportCsv() {
    const sheet = buildNetworkSheet(members ?? [], leaderName);
    downloadCsv(sheet.rows, `rede-${leaderName}`);
  }

  return (
    <>
      <PageHeader
        title="Minha rede"
        description="Cadastre os @ das pessoas da sua rede. Só quem estiver aqui é contado nas análises."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={(members ?? []).length === 0}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={(members ?? []).length === 0}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
          </>
        }
      />

      {coordinator && !session?.leaderId ? (
        <div className="max-w-sm space-y-2">
          <Label>Rede do líder</Label>
          <Select value={leaderId} onValueChange={setLeaderId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um líder" />
            </SelectTrigger>
            <SelectContent>
              {(leaders ?? []).map((leader) => (
                <SelectItem key={leader.id} value={leader.id}>
                  {leader.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar uma pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSingle} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="perfil">@ do Instagram</Label>
                <Input
                  id="perfil"
                  value={single}
                  onChange={(e) => setSingle(e.target.value)}
                  placeholder="@joaodasilva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome-membro">Nome (opcional)</Label>
                <Input
                  id="nome-membro"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="João da Silva"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar vários de uma vez</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBulk} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lista">Cole a lista de @</Label>
                <Textarea
                  id="lista"
                  rows={6}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  placeholder={"@maria\n@joao, @ana\nhttps://instagram.com/pedro"}
                />
                <p className="text-xs text-muted-foreground">
                  Pode colar um por linha, separados por vírgula ou copiados de uma planilha.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="arquivo">Ou envie um arquivo CSV/TXT</Label>
                <Input id="arquivo" type="file" accept=".csv,.txt" onChange={handleFile} />
              </div>
              {preview ? (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{preview.valid.length}</strong> perfis prontos
                  para adicionar
                  {preview.duplicatesInInput > 0
                    ? ` · ${preview.duplicatesInInput} repetidos ignorados`
                    : ""}
                  {preview.invalid.length > 0
                    ? ` · ${preview.invalid.length} não reconhecidos`
                    : ""}
                </p>
              ) : null}
              <Button type="submit" disabled={saving || !preview?.valid.length}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Adicionar lista
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Pessoas na rede ({(members ?? []).filter((m) => m.active).length} ativas)
          </CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por @ ou nome"
            className="sm:max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum perfil cadastrado ainda"
              description="Adicione os @ das pessoas da sua rede para começar a medir a participação."
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {filtered.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">@{member.instagram_username}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.display_name ? `${member.display_name} · ` : ""}
                      desde {formatDate(member.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.active ? null : <Badge variant="outline">Inativo</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(member.id, !member.active)}
                    >
                      {member.active ? "Desativar" : "Reativar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PrivacyNotice />
    </>
  );
}
