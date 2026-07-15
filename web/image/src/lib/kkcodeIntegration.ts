type StorageReader = Pick<Storage, "getItem">;
type SearchInput = URLSearchParams | string | undefined;

function getSearchParams(input?: SearchInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === "string") return new URLSearchParams(input);
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getStorage(): StorageReader | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function isKkcodeIntegration(search?: SearchInput): boolean {
  return getSearchParams(search).get("integration") === "kkcode";
}

export function getKkcodeUserId(
  storage: StorageReader | null = getStorage(),
): number {
  if (!storage) throw new Error("登录状态不可用，请重新登录");

  try {
    const rawUser = storage.getItem("user");
    const user = rawUser ? (JSON.parse(rawUser) as { id?: unknown }) : null;
    const userId = Number(user?.id);
    if (Number.isInteger(userId) && userId > 0) return userId;
  } catch {
    // The common error below is clearer than exposing storage parsing details.
  }

  throw new Error("登录状态已失效，请重新登录");
}

export function getKkcodeRequestHeaders(
  search?: SearchInput,
  storage: StorageReader | null = getStorage(),
): Record<string, string> | null {
  if (!isKkcodeIntegration(search)) return null;
  return { "New-Api-User": String(getKkcodeUserId(storage)) };
}

export function getKkcodeApiUrl(
  path: string,
  search?: SearchInput,
): string | null {
  if (!isKkcodeIntegration(search)) return null;
  const endpoint = path.replace(/^\/+/, "").replace(/^v1\//, "");
  return `/pg/${endpoint}`;
}
