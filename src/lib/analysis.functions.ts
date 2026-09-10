import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePostUrl } from "./usernames";

export type RunAnalysisInput = { url: string; leaderId: string };
export type RunAnalysisOutput = {
  analysisId: string;
  status: "completed" | "failed";
  source: "demo" | "meta_graph";
  message?: string;
};

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunAnalysisInput) => {
    if (!input || typeof input.url !== "string" || typeof input.leaderId !== "string") {
      throw new Error("Dados inválidos para a análise.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<RunAnalysisOutput> => {
    const { supabase, userId } = context;

    const parsed = parsePostUrl(data.url);
    if (!parsed.ok) throw new Error(parsed.error ?? "Link inválido.");

    const { data: leader, error: leaderError } = await supabase
      .from("leaders")
      .select("id, campaign_id, name")
      .eq("id", data.leaderId)
      .maybeSingle();
    if (leaderError) throw new Error(leaderError.message);
    if (!leader) throw new Error("Líder não encontrado ou fora da sua campanha.");

    const campaignId = leader.campaign_id;

    const { data: members, error: membersError } = await supabase
      .from("network_members")
      .select("id, instagram_username")
      .eq("leader_id", leader.id)
      .eq("active", true);
    if (membersError) throw new Error(membersError.message);

    const networkUsernames = (members ?? []).map((m) => m.instagram_username);
    const memberByUsername = new Map(
      (members ?? []).map((m) => [m.instagram_username.toLowerCase(), m.id] as const),
    );

    const { data: connection } = await supabase
      .from("instagram_connections")
      .select("status, external_account_id, token_secret_name")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    const { resolveProvider } = await import("./instagram/provider.server");
    const { ProviderNotConfiguredError } = await import("./instagram/types");
    const provider = resolveProvider(connection ?? null);

    let result;
    try {
      result = await provider.fetchInteractions({
        url: parsed.url,
        shortcode: parsed.shortcode,
        networkUsernames,
      });
    } catch (error) {
      const message =
        error instanceof ProviderNotConfiguredError
          ? error.message
          : "Não conseguimos consultar a publicação agora. Tente novamente em alguns minutos.";
      const { data: failed } = await supabase
        .from("analyses")
        .insert({
          campaign_id: campaignId,
          leader_id: leader.id,
          created_by: userId,
          url: parsed.url,
          shortcode: parsed.shortcode,
          status: "failed",
          source: provider.id,
          error_message: message,
          network_size_snapshot: networkUsernames.length,
        })
        .select("id")
        .single();
      return {
        analysisId: failed?.id ?? "",
        status: "failed",
        source: provider.id,
        message,
      };
    }

    // registra/atualiza a publicação
    let postId: string | null = null;
    if (parsed.shortcode) {
      const { data: post } = await supabase
        .from("posts")
        .upsert(
          {
            campaign_id: campaignId,
            shortcode: parsed.shortcode,
            url: parsed.url,
            external_post_id: result.metrics.externalPostId,
            caption: result.metrics.caption,
            published_at: result.metrics.publishedAt,
            likes_count: result.metrics.likesCount,
            comments_count: result.metrics.commentsCount,
            shares_count: result.metrics.sharesCount,
            reach: result.metrics.reach,
            impressions: result.metrics.impressions,
          },
          { onConflict: "campaign_id,shortcode" },
        )
        .select("id")
        .single();
      postId = post?.id ?? null;
    }

    const networkSet = new Set(networkUsernames.map((u) => u.toLowerCase()));
    const matched = result.interactions.filter((i) => networkSet.has(i.username.toLowerCase()));
    const uniqueParticipants = new Set(matched.map((i) => i.username.toLowerCase()));
    const networkSize = networkUsernames.length;
    const rate = networkSize > 0 ? (uniqueParticipants.size / networkSize) * 100 : 0;

    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        campaign_id: campaignId,
        leader_id: leader.id,
        post_id: postId,
        created_by: userId,
        url: parsed.url,
        shortcode: parsed.shortcode,
        status: "completed",
        source: result.source,
        network_size_snapshot: networkSize,
        identified_participants_count: uniqueParticipants.size,
        participation_rate: Number(rate.toFixed(2)),
      })
      .select("id")
      .single();
    if (analysisError || !analysis) {
      throw new Error(analysisError?.message ?? "Não foi possível salvar a análise.");
    }

    if (matched.length > 0) {
      const rows = matched.map((i) => ({
        campaign_id: campaignId,
        analysis_id: analysis.id,
        leader_id: leader.id,
        network_member_id: memberByUsername.get(i.username.toLowerCase()) ?? null,
        instagram_username: i.username,
        interaction_type: i.interactionType,
        comment_text: i.commentText,
        interacted_at: i.interactedAt,
        raw_external_id: i.externalId,
      }));
      const { error: resultsError } = await supabase.from("interaction_results").insert(rows);
      if (resultsError) throw new Error(resultsError.message);
    }

    await supabase.from("audit_logs").insert({
      campaign_id: campaignId,
      user_id: userId,
      action: "analysis.run",
      entity_type: "analysis",
      entity_id: analysis.id,
    });

    return { analysisId: analysis.id, status: "completed", source: result.source };
  });
