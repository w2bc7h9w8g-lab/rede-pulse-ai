export type ParsedUsernames = {
  valid: string[];
  invalid: string[];
  duplicatesInInput: number;
  totalRead: number;
};

const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export function normalizeUsername(raw: string): string {
  let value = raw.trim().toLowerCase();
  // aceita URLs completas do Instagram
  const urlMatch = value.match(/instagram\.com\/([a-z0-9._]+)/i);
  if (urlMatch?.[1]) value = urlMatch[1];
  value = value.replace(/^@+/, "");
  value = value.replace(/\/+$/, "");
  return value.trim();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value) && !value.startsWith(".") && !value.endsWith(".");
}

/** Aceita quebras de linha, vírgulas, ponto e vírgula, tabulações e espaços. */
export function parseUsernameList(input: string): ParsedUsernames {
  const tokens = input
    .split(/[\n\r,;\t|]+/)
    .flatMap((part) => part.split(/\s+/))
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicatesInInput = 0;

  for (const token of tokens) {
    const normalized = normalizeUsername(token);
    if (!normalized) continue;
    if (!isValidUsername(normalized)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(normalized)) {
      duplicatesInInput += 1;
      continue;
    }
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicatesInInput, totalRead: tokens.length };
}

export type ParsedPostUrl = {
  ok: boolean;
  url: string;
  shortcode: string | null;
  error?: string;
};

export function parsePostUrl(input: string): ParsedPostUrl {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, url: raw, shortcode: null, error: "Cole o link da publicação." };
  }
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, url: raw, shortcode: null, error: "Esse link não parece válido." };
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
    return {
      ok: false,
      url: raw,
      shortcode: null,
      error: "Use um link de publicação do Instagram (instagram.com).",
    };
  }
  const match = url.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!match?.[2]) {
    return {
      ok: false,
      url: url.toString(),
      shortcode: null,
      error: "Não encontramos o código da publicação nesse link. Copie o link direto do post ou reel.",
    };
  }
  const clean = `https://www.instagram.com/${match[1] === "reels" ? "reel" : match[1]}/${match[2]}/`;
  return { ok: true, url: clean, shortcode: match[2] };
}
