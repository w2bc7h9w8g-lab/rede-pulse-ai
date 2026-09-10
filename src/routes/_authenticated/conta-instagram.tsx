import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Instagram, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PrivacyNotice } from "@/components/app/DemoNotice";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta-instagram")({
  head: () => ({
    meta: [
      { title: "Conta do Instagram — RedePulse" },
      {
        name: "description",
        content: "Conecte a conta profissional do Instagram da campanha com segurança.",
      },
      { property: "og:title", content: "Conta do Instagram — RedePulse" },
      { property: "og:description", content: "Conecte a conta oficial da campanha." },
    ],
  }),
  component: InstagramAccount,
});

function InstagramAccount() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const coordinator = isCoordinator(session);
  const [account, setAccount] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: connection } = useQuery({
    queryKey: ["conexao-instagram"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_connections")
        .select("id, status, external_account_id, account_username, connected_at, token_secret_name")
        .maybeSingle();
      return data ?? null;
    },
    enabled: coordinator,
  });

  if (!coordinator) {
    return (
      <EmptyState
        title="Área da coordenação"
        description="Somente quem coordena a campanha configura a conta do Instagram."
      />
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.campaign?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("instagram_connections").upsert(
        {
          campaign_id: session.campaign.id,
          account_username: account.trim().replace(/^@/, "") || null,
          status: "pending",
          token_secret_name: "META_ACCESS_TOKEN",
        },
        { onConflict: "campaign_id" },
      );
      if (error) throw error;
      toast.success("Dados salvos. Falta apenas concluir a autorização com a Meta.");
      await queryClient.invalidateQueries({ queryKey: ["conexao-instagram"] });
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const connected = connection?.status === "connected";

  return (
    <>
      <PageHeader
        title="Conta do Instagram"
        description="Conectamos apenas a conta profissional oficial da campanha, pelo login seguro da Meta. Nunca pedimos a senha de ninguém."
      />

      <Card className="max-w-2xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Situação da conexão</CardTitle>
          {connected ? (
            <Badge variant="secondary">
              <CheckCircle2 className="size-3" /> Conectada
            </Badge>
          ) : (
            <Badge variant="outline">Não conectada</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {connected ? (
            <p className="text-sm text-muted-foreground">
              Conta <strong>@{connection?.account_username}</strong> conectada em{" "}
              {formatDateTime(connection?.connected_at)}. As análises usam dados oficiais do
              Instagram.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enquanto a conta oficial não estiver conectada, as análises rodam em modo de
              demonstração e os resultados são fictícios.
            </p>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conta">@ da conta profissional da campanha</Label>
              <Input
                id="conta"
                value={account || connection?.account_username || ""}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="@suacampanha"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar conta
              </Button>
              <Button
                type="button"
                onClick={() =>
                  toast.info("Autorização com a Meta", {
                    description:
                      "A autorização oficial é liberada assim que o app for aprovado pela Meta. Enquanto isso, o sistema segue em modo de demonstração.",
                  })
                }
              >
                <Instagram className="size-4" /> Conectar com a Meta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">O que conseguimos identificar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Comentários feitos por perfis da rede nas publicações da campanha.</p>
          <p>• Menções ao perfil da campanha dentro dos comentários.</p>
          <p>• Números totais da publicação: curtidas, comentários, alcance e impressões.</p>
          <p>
            • <strong className="text-foreground">Não</strong> é possível listar quem curtiu
            individualmente — o Instagram não disponibiliza essa informação.
          </p>
        </CardContent>
      </Card>

      <PrivacyNotice />
    </>
  );
}
