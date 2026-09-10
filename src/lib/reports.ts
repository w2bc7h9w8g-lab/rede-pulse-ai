import { supabase } from "@/integrations/supabase/client";
import { brDayKey, formatDate, formatDateTime, interactionLabel } from "./format";
import type { CellValue, SheetSpec } from "./excel";

export type AnalysisRecord = {
  id: string;
  analyzed_at: string;
  url: string;
  shortcode: string | null;
  status: string;
  source: string;
  error_message: string | null;
  network_size_snapshot: number;
  identified_participants_count: number;
  participation_rate: number;
  leader_id: string;
  leaders: { id: string; name: string } | null;
  posts: {
    likes_count: number | null;
    comments_count: number | null;
    shares_count: number | null;
    reach: number | null;
    impressions: number | null;
  } | null;
};

export type InteractionRecord = {
  id: string;
  analysis_id: string;
  instagram_username: string;
  interaction_type: string;
  comment_text: string | null;
  interacted_at: string | null;
  leader_id: string;
};

export type ReportFilters = {
  leaderId?: string | null;
  from?: string | null;
  to?: string | null;
};

const ANALYSIS_SELECT =
  "id, analyzed_at, url, shortcode, status, source, error_message, network_size_snapshot, identified_participants_count, participation_rate, leader_id, leaders(id, name), posts(likes_count, comments_count, shares_count, reach, impressions)";

export async function fetchAnalyses(filters: ReportFilters = {}): Promise<AnalysisRecord[]> {
  let query = supabase
    .from("analyses")
    .select(ANALYSIS_SELECT)
    .order("analyzed_at", { ascending: false });

  if (filters.leaderId) query = query.eq("leader_id", filters.leaderId);
  if (filters.from) query = query.gte("analyzed_at", `${filters.from}T00:00:00-03:00`);
  if (filters.to) query = query.lte("analyzed_at", `${filters.to}T23:59:59-03:00`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AnalysisRecord[];
}

export async function fetchInteractions(analysisIds: string[]): Promise<InteractionRecord[]> {
  if (analysisIds.length === 0) return [];
  const { data, error } = await supabase
    .from("interaction_results")
    .select("id, analysis_id, instagram_username, interaction_type, comment_text, interacted_at, leader_id")
    .in("analysis_id", analysisIds);
  if (error) throw error;
  return (data ?? []) as InteractionRecord[];
}

const DETAIL_HEADER: CellValue[] = [
  "Data",
  "Hora da análise",
  "Líder",
  "Publicação",
  "Código da publicação",
  "Participante (@)",
  "Tipo de interação",
  "Comentário",
  "Horário da interação",
  "Tamanho da rede",
  "Participantes identificados",
  "Participação identificada (%)",
  "Curtidas da publicação",
  "Comentários da publicação",
  "Compartilhamentos",
  "Alcance",
  "Impressões",
  "Origem dos dados",
  "Situação",
];

function detailRow(
  analysis: AnalysisRecord,
  interaction: InteractionRecord | null,
): CellValue[] {
  return [
    formatDate(analysis.analyzed_at),
    formatDateTime(analysis.analyzed_at),
    analysis.leaders?.name ?? "—",
    analysis.url,
    analysis.shortcode ?? "—",
    interaction ? `@${interaction.instagram_username}` : "—",
    interaction ? interactionLabel(interaction.interaction_type) : "Nenhuma participação",
    interaction?.comment_text ?? "",
    interaction?.interacted_at ? formatDateTime(interaction.interacted_at) : "",
    analysis.network_size_snapshot,
    analysis.identified_participants_count,
    Number(analysis.participation_rate),
    analysis.posts?.likes_count ?? null,
    analysis.posts?.comments_count ?? null,
    analysis.posts?.shares_count ?? null,
    analysis.posts?.reach ?? null,
    analysis.posts?.impressions ?? null,
    analysis.source === "demo" ? "Demonstração" : "Instagram (oficial)",
    analysis.status === "completed"
      ? "Concluída"
      : analysis.status === "failed"
        ? `Falhou: ${analysis.error_message ?? ""}`
        : analysis.status,
  ];
}

export function buildAnalysisSheets(
  analyses: AnalysisRecord[],
  interactions: InteractionRecord[],
): SheetSpec[] {
  const byAnalysis = new Map<string, InteractionRecord[]>();
  for (const interaction of interactions) {
    const list = byAnalysis.get(interaction.analysis_id) ?? [];
    list.push(interaction);
    byAnalysis.set(interaction.analysis_id, list);
  }

  const days = new Map<string, AnalysisRecord[]>();
  for (const analysis of analyses) {
    const key = brDayKey(analysis.analyzed_at);
    const list = days.get(key) ?? [];
    list.push(analysis);
    days.set(key, list);
  }

  const orderedDays = [...days.keys()].sort();

  const summaryRows: CellValue[][] = [
    [
      "Dia",
      "Análises",
      "Líderes envolvidos",
      "Participantes identificados",
      "Soma do tamanho das redes",
      "Participação média (%)",
    ],
  ];

  for (const day of orderedDays) {
    const list = days.get(day) ?? [];
    const leaders = new Set(list.map((a) => a.leader_id));
    const participants = list.reduce((sum, a) => sum + a.identified_participants_count, 0);
    const networkSum = list.reduce((sum, a) => sum + a.network_size_snapshot, 0);
    const avg =
      list.length > 0
        ? list.reduce((sum, a) => sum + Number(a.participation_rate), 0) / list.length
        : 0;
    summaryRows.push([
      day,
      list.length,
      leaders.size,
      participants,
      networkSum,
      Number(avg.toFixed(2)),
    ]);
  }

  summaryRows.push([]);
  summaryRows.push([
    "TOTAL",
    analyses.length,
    new Set(analyses.map((a) => a.leader_id)).size,
    analyses.reduce((sum, a) => sum + a.identified_participants_count, 0),
    analyses.reduce((sum, a) => sum + a.network_size_snapshot, 0),
    analyses.length > 0
      ? Number(
          (
            analyses.reduce((sum, a) => sum + Number(a.participation_rate), 0) / analyses.length
          ).toFixed(2),
        )
      : 0,
  ]);

  const sheets: SheetSpec[] = [{ name: "Resumo", rows: summaryRows }];

  for (const day of orderedDays) {
    const rows: CellValue[][] = [DETAIL_HEADER];
    for (const analysis of days.get(day) ?? []) {
      const list = byAnalysis.get(analysis.id) ?? [];
      if (list.length === 0) {
        rows.push(detailRow(analysis, null));
      } else {
        for (const interaction of list) rows.push(detailRow(analysis, interaction));
      }
    }
    sheets.push({ name: day, rows });
  }

  return sheets;
}

export function buildNetworkSheet(
  members: Array<{
    instagram_username: string;
    display_name: string | null;
    active: boolean;
    created_at: string;
  }>,
  leaderName: string,
): SheetSpec {
  const rows: CellValue[][] = [
    ["Usuário (@)", "Nome", "Situação", "Líder", "Cadastrado em"],
  ];
  for (const member of members) {
    rows.push([
      `@${member.instagram_username}`,
      member.display_name ?? "",
      member.active ? "Ativo" : "Inativo",
      leaderName,
      formatDate(member.created_at),
    ]);
  }
  return { name: "Minha rede", rows };
}
