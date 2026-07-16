import type { ApiProvider } from "../types";

type SearchInput = URLSearchParams | string | undefined;
export type KkcodeLocation = Pick<Location, "origin">;

export type KkcodeApiProvider = "openai" | "gemini";

function getSearchParams(input?: SearchInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === "string") return new URLSearchParams(input);
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getLocation(): KkcodeLocation | null {
  if (typeof window === "undefined") return null;
  return window.location;
}

export function isKkcodeIntegration(search?: SearchInput): boolean {
  return getSearchParams(search).get("integration") === "kkcode";
}

export function isKkcodeApiProvider(
  provider: ApiProvider,
): provider is KkcodeApiProvider {
  return provider === "openai" || provider === "gemini";
}

export function getKkcodeApiBaseUrl(
  provider: KkcodeApiProvider,
  location: KkcodeLocation | null = getLocation(),
): string {
  const version = provider === "gemini" ? "v1beta" : "v1";
  const origin = location?.origin.trim().replace(/\/+$/, "");
  return origin ? `${origin}/${version}` : `/${version}`;
}
