import {
  ProviderNotConfiguredError,
  type InstagramProvider,
  type ProviderInteraction,
  type ProviderRequest,
  type ProviderResult,
} from "./types";

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const DEMO_COMMENTS = [
  "Apoio total! 👏",
  "Estamos juntos nessa!",
  "Muito bom, parabéns pelo trabalho.",
  "Conte comigo aqui no bairro!",
  "Compartilhando com a galera 🙌",
  "Isso que é compromisso com a comunidade.",
  "Presente! 💪",
  "Excelente proposta.",
];

/**
 * Provedor de DEMONSTRAÇÃO.
 * Gera interações fictícias, de forma determinística, apenas para avaliação visual.
 * Os dados são sempre identificados como demonstração na interface.
 */
export class DemoInstagramProvider implements InstagramProvider {
  readonly id = "demo" as const;

  async fetchInteractions(request: ProviderRequest): Promise<ProviderResult> {
    const seed = hash(request.shortcode ?? request.url);
    const interactions: ProviderInteraction[] = [];
    const baseTime = Date.now() - 1000 * 60 * 60 * 6;

    request.networkUsernames.forEach((username, index) => {
      const score = hash(`${seed}:${username}`) % 100;
      if (score >= 22) return; // ~22% da rede participa na demonstração
      const isMention = score % 5 === 0;
      interactions.push({
        username,
        interactionType: isMention ? "mention" : "comment",
        commentText: isMention
          ? null
          : (DEMO_COMMENTS[hash(`${username}:${seed}`) % DEMO_COMMENTS.length] ?? null),
        interactedAt: new Date(baseTime + index * 1000 * 97).toISOString(),
        externalId: `demo_${seed}_${index}`,
      });
    });

    // interações de pessoas fora da rede (existem no post, mas não são da rede do líder)
    const outsiders = 5 + (seed % 12);

    return {
      source: "demo",
      interactions,
      metrics: {
        externalPostId: `demo_${request.shortcode ?? seed}`,
        caption: "Publicação de demonstração",
        publishedAt: new Date(baseTime).toISOString(),
        likesCount: 320 + (seed % 900),
        commentsCount: interactions.length + outsiders,
        sharesCount: null,
        reach: 2500 + (seed % 8000),
        impressions: 3200 + (seed % 12000),
      },
    };
  }
}

/**
 * Provedor oficial Meta/Instagram Graph API.
 * Estrutura pronta: o token fica exclusivamente no servidor e nunca no navegador.
 * Enquanto a conta profissional da campanha não estiver conectada com credenciais
 * válidas da Meta, este provedor recusa a execução em vez de inventar dados.
 */
export class MetaGraphProvider implements InstagramProvider {
  readonly id = "meta_graph" as const;

  constructor(
    private readonly accessToken: string | undefined,
    private readonly externalAccountId: string | null,
  ) {}

  async fetchInteractions(request: ProviderRequest): Promise<ProviderResult> {
    if (!this.accessToken || !this.externalAccountId) {
      throw new ProviderNotConfiguredError(
        "A conta profissional do Instagram da campanha ainda não está conectada.",
      );
    }

    const base = "https://graph.facebook.com/v21.0";
    const mediaId = await this.resolveMediaId(base, request);
    if (!mediaId) {
      throw new ProviderNotConfiguredError(
        "Não foi possível localizar essa publicação na conta conectada.",
      );
    }

    const commentsRes = await fetch(
      `${base}/${mediaId}/comments?fields=id,text,timestamp,username&limit=200&access_token=${this.accessToken}`,
    );
    if (!commentsRes.ok) {
      const body = await commentsRes.text();
      throw new Error(`Instagram Graph API [${commentsRes.status}]: ${body}`);
    }
    const commentsJson = (await commentsRes.json()) as {
      data?: Array<{ id: string; text?: string; timestamp?: string; username?: string }>;
    };

    const interactions: ProviderInteraction[] = (commentsJson.data ?? [])
      .filter((c) => Boolean(c.username))
      .map((c) => ({
        username: String(c.username).toLowerCase(),
        interactionType: "comment" as const,
        commentText: c.text ?? null,
        interactedAt: c.timestamp ?? null,
        externalId: c.id,
      }));

    const mediaRes = await fetch(
      `${base}/${mediaId}?fields=id,caption,timestamp,like_count,comments_count&access_token=${this.accessToken}`,
    );
    const media = mediaRes.ok
      ? ((await mediaRes.json()) as {
          caption?: string;
          timestamp?: string;
          like_count?: number;
          comments_count?: number;
        })
      : {};

    return {
      source: "meta_graph",
      interactions,
      metrics: {
        externalPostId: mediaId,
        caption: media.caption ?? null,
        publishedAt: media.timestamp ?? null,
        likesCount: media.like_count ?? null,
        commentsCount: media.comments_count ?? null,
        sharesCount: null,
        reach: null,
        impressions: null,
      },
    };
  }

  private async resolveMediaId(base: string, request: ProviderRequest): Promise<string | null> {
    if (!request.shortcode) return null;
    const res = await fetch(
      `${base}/${this.externalAccountId}/media?fields=id,permalink&limit=100&access_token=${this.accessToken}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ id: string; permalink?: string }> };
    const found = (json.data ?? []).find((m) => m.permalink?.includes(request.shortcode ?? "@@"));
    return found?.id ?? null;
  }
}

export type ConnectionRow = {
  status: string | null;
  external_account_id: string | null;
  token_secret_name: string | null;
};

export function resolveProvider(connection: ConnectionRow | null): InstagramProvider {
  if (connection?.status === "connected" && connection.external_account_id) {
    const token = connection.token_secret_name
      ? process.env[connection.token_secret_name]
      : process.env["META_INSTAGRAM_ACCESS_TOKEN"];
    return new MetaGraphProvider(token, connection.external_account_id);
  }
  return new DemoInstagramProvider();
}
