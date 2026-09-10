/**
 * Camada de abstração para provedores de dados do Instagram.
 *
 * MVP: apenas interações identificáveis pela API oficial (comentários e menções).
 * Curtidas individuais NÃO são suportadas pela API oficial e permanecem como
 * capacidade futura (ver `LikersProvider`), sem simulação de dados reais.
 */

export type SupportedInteraction = "comment" | "mention";

export type ProviderInteraction = {
  username: string;
  interactionType: SupportedInteraction;
  commentText: string | null;
  interactedAt: string | null;
  externalId: string | null;
};

export type ProviderPostMetrics = {
  externalPostId: string | null;
  caption: string | null;
  publishedAt: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  reach: number | null;
  impressions: number | null;
};

export type ProviderResult = {
  source: "demo" | "meta_graph";
  interactions: ProviderInteraction[];
  metrics: ProviderPostMetrics;
};

export type ProviderRequest = {
  url: string;
  shortcode: string | null;
  /** usernames ativos da rede do líder, já normalizados */
  networkUsernames: string[];
};

export interface InstagramProvider {
  readonly id: "demo" | "meta_graph";
  fetchInteractions(request: ProviderRequest): Promise<ProviderResult>;
}

/** Interface reservada para futura integração de terceiros com curtidas. */
export interface LikersProvider {
  readonly id: string;
  fetchLikers(request: ProviderRequest): Promise<string[]>;
}

export class ProviderNotConfiguredError extends Error {
  code = "provider_not_configured" as const;
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}
