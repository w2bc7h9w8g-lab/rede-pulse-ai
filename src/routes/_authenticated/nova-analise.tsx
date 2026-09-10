import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
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
import { DemoNotice, PrivacyNotice } from "@/components/app/DemoNotice";
import { supabase } from "@/integrations/supabase/client";
import { isCoordinator, useSession } from "@/lib/session";
import { parsePostUrl } from "@/lib/usernames";
import { runAnalysis } from "@/lib/analysis.functions";

export const Route = createFileRoute("/_authenticated/nova-analise")({
  head: () => ({
    meta: [
      { title: "Nova análise — RedePulse" },
      {
        name: "description",
        content: "Cole o link de uma publicação do Instagram e veja quem da rede participou.",
      },
      { property: "og:title", content: "Nova análise — RedePulse" },
      { property: "og:description", content: "Analise a participação da sua rede." },
    ],
  }),
  component: NewAnalysis,
});

function NewAnalysis() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyze = useServerFn(runAnalysis);
  const coordinator = isCoordinator(session);

  const [url, setUrl] = useState("");
  const [leaderId, setLeaderId] = useState<string>("");
  const [running, setRunning] = useState(false);

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

  const parsed = url.trim() ? parsePostUrl(url) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed?.ok) {
      toast.error(parsed?.error ?? "Cole o link da publicação.");
      return;
    }
    if (!leaderId) {
      toast.error("Escolha o líder da rede que será analisada.");
      return;
    }
    setRunning(true);
    try {
      const result = await analyze({ data: { url: parsed.url, leaderId } });
      await queryClient.invalidateQueries();
      if (result.status === "failed") {
        toast.error("Não foi possível concluir a análise", { description: result.message });
        if (result.analysisId) navigate({ to: "/analise/$id", params: { id: result.analysisId } });
        return;
      }
      toast.success("Análise concluída!");
      navigate({ to: "/analise/$id", params: { id: result.analysisId } });
    } catch (error) {
      toast.error("Não foi possível analisar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Nova análise"
        description="Cole o link de uma publicação do Instagram da campanha. Em segundos mostramos quem da rede aparece nos comentários e menções."
      />

      {session?.campaign?.is_demo ? <DemoNotice /> : null}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Publicação</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="url">Link da publicação ou reel</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/XXXXXXXX/"
                  className="pl-9"
                  inputMode="url"
                />
              </div>
              {parsed && !parsed.ok ? (
                <p className="text-sm text-destructive">{parsed.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No Instagram, toque nos três pontinhos da publicação e escolha “Copiar link”.
                </p>
              )}
            </div>

            {coordinator && !session?.leaderId ? (
              <div className="space-y-2">
                <Label>Rede que será analisada</Label>
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

            <Button type="submit" size="lg" disabled={running} className="w-full sm:w-auto">
              {running ? <Loader2 className="size-4 animate-spin" /> : null}
              {running ? "Analisando…" : "Analisar publicação"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PrivacyNotice />
    </>
  );
}
