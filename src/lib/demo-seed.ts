import { supabase } from "@/integrations/supabase/client";

const FIRST = [
  "ana",
  "bruno",
  "carla",
  "diego",
  "elaine",
  "fabio",
  "gisele",
  "helio",
  "isabela",
  "joao",
  "karina",
  "lucas",
  "marcia",
  "nelson",
  "olivia",
  "paulo",
  "quenia",
  "renata",
  "sergio",
  "tatiane",
  "ubirajara",
  "vanessa",
  "wagner",
  "yara",
  "zeca",
  "amanda",
  "rafael",
  "juliana",
];
const LAST = ["silva", "souza", "oliveira", "santos", "lima", "costa", "rocha", "alves"];

function displayName(user: string): string {
  return user
    .split(".")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const DEMO_COMMENTS = [
  "Apoio total! 👏",
  "Estamos juntos nessa!",
  "Muito bom, parabéns pelo trabalho.",
  "Conte comigo aqui no bairro!",
  "Compartilhando com a galera 🙌",
];

export async function seedDemoData(campaignId: string): Promise<void> {
  const leaderNames = ["Jaqueline Moraes", "Ricardo Tavares"];
  const { data: leaders, error: leadersError } = await supabase
    .from("leaders")
    .insert(
      leaderNames.map((name) => ({
        campaign_id: campaignId,
        name,
        status: "active" as const,
        is_demo: true,
      })),
    )
    .select("id, name");
  if (leadersError) throw leadersError;

  for (const [index, leader] of (leaders ?? []).entries()) {
    const members = Array.from({ length: 26 }, (_, i) => {
      const first = FIRST[(i + index * 7) % FIRST.length] as string;
      const last = LAST[(i * 3 + index) % LAST.length] as string;
      const username = `${first}.${last}${index}${i}`;
      return {
        campaign_id: campaignId,
        leader_id: leader.id,
        instagram_username: username,
        display_name: displayName(`${first}.${last}`),
        active: true,
      };
    });
    const { data: insertedMembers, error: membersError } = await supabase
      .from("network_members")
      .insert(members)
      .select("id, instagram_username");
    if (membersError) throw membersError;

    // três análises históricas em dias diferentes
    for (let a = 0; a < 3; a += 1) {
      const when = new Date(Date.now() - (a + 1) * 24 * 60 * 60 * 1000);
      const shortcode = `Demo${index}${a}${Math.random().toString(36).slice(2, 7)}`;
      const url = `https://www.instagram.com/p/${shortcode}/`;

      const { data: post } = await supabase
        .from("posts")
        .insert({
          campaign_id: campaignId,
          shortcode,
          url,
          caption: "Publicação de demonstração",
          published_at: when.toISOString(),
          likes_count: 420 + a * 133 + index * 57,
          comments_count: 38 + a * 9,
          reach: 4200 + a * 900,
          impressions: 5600 + a * 1100,
        })
        .select("id")
        .single();

      const picked = (insertedMembers ?? []).filter((_, i) => (i + a) % (4 + a) === 0);
      const rate = insertedMembers?.length
        ? (picked.length / insertedMembers.length) * 100
        : 0;

      const { data: analysis, error: analysisError } = await supabase
        .from("analyses")
        .insert({
          campaign_id: campaignId,
          leader_id: leader.id,
          post_id: post?.id ?? null,
          url,
          shortcode,
          status: "completed" as const,
          source: "demo",
          analyzed_at: when.toISOString(),
          network_size_snapshot: insertedMembers?.length ?? 0,
          identified_participants_count: picked.length,
          participation_rate: Number(rate.toFixed(2)),
        })
        .select("id")
        .single();
      if (analysisError) throw analysisError;

      if (picked.length > 0 && analysis) {
        await supabase.from("interaction_results").insert(
          picked.map((m, i) => ({
            campaign_id: campaignId,
            analysis_id: analysis.id,
            leader_id: leader.id,
            network_member_id: m.id,
            instagram_username: m.instagram_username,
            interaction_type: (i % 5 === 0 ? "mention" : "comment") as "mention" | "comment",
            comment_text:
              i % 5 === 0 ? null : (DEMO_COMMENTS[i % DEMO_COMMENTS.length] as string),
            interacted_at: new Date(when.getTime() + i * 60000).toISOString(),
          })),
        );
      }
    }
  }
}
