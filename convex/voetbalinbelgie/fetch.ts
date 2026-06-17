import { normalizeCompetitionPath } from "../lib/voetbalinbelgie/allowlist";
import { parseCompetitionJson } from "../lib/voetbalinbelgie/parseCompetition";
import type { ParsedCompetitionDto } from "../lib/voetbalinbelgie/types";

const PUBLIC_BASE = "https://www.voetbalinbelgie.be";
const API_BASE = "https://api.voetbalinbelgie.be";
const FETCH_TIMEOUT_MS = 30_000;

function composeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason);
      },
      { once: true },
    );
  }
  return controller.signal;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? composeAbortSignals([controller.signal, init.signal])
    : controller.signal;

  try {
    const response = await fetch(url, {
      ...init,
      signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status}) for ${url}`);
    }
    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timed out for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchStamnummersHtml(): Promise<string> {
  return fetchText(`${PUBLIC_BASE}/stamnummers/`);
}

export async function fetchClubPageHtml(slugPath: string): Promise<string> {
  const normalizedPath = slugPath.startsWith("/") ? slugPath : `/${slugPath}`;
  return fetchText(`${PUBLIC_BASE}${normalizedPath}`);
}

export async function fetchCompetitionJson(
  path: string,
  apiKey: string,
): Promise<ParsedCompetitionDto> {
  const normalizedPath = normalizeCompetitionPath(path);
  const url = `${API_BASE}${normalizedPath}`;
  const jsonText = await fetchText(url, {
    headers: {
      "X-Api-Key": apiKey,
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Failed to parse competition JSON for ${normalizedPath}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  return parseCompetitionJson(parsed);
}
