type StorageReader = Pick<Storage, "getItem">;
type SearchInput = URLSearchParams | string | undefined;

export interface KkcodeGroupOption {
  name: string;
  desc: string;
  ratio: number | string;
}

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
  group?: string,
): Record<string, string> | null {
  if (!isKkcodeIntegration(search)) return null;
  const headers: Record<string, string> = {
    "New-Api-User": String(getKkcodeUserId(storage)),
  };
  const normalizedGroup = group?.trim();
  if (normalizedGroup) headers["New-Api-Group"] = normalizedGroup;
  return headers;
}

export async function fetchKkcodeGroups(
  search?: SearchInput,
  storage: StorageReader | null = getStorage(),
): Promise<KkcodeGroupOption[]> {
  const headers = getKkcodeRequestHeaders(search, storage);
  if (!headers) return [];

  const response = await fetch("/api/user/self/groups", {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: Record<string, { desc?: unknown; ratio?: unknown }>;
  };
  if (!response.ok || payload.success !== true || !payload.data) {
    throw new Error(payload.message || "无法加载可用分组");
  }

  return Object.entries(payload.data)
    .map(([name, item]) => ({
      name,
      desc: typeof item.desc === "string" ? item.desc : name,
      ratio:
        typeof item.ratio === "number" || typeof item.ratio === "string"
          ? item.ratio
          : 1,
    }))
    .sort((a, b) => {
      if (a.name === "auto") return -1;
      if (b.name === "auto") return 1;
      return a.name.localeCompare(b.name);
    });
}

export function getKkcodeApiUrl(
  path: string,
  search?: SearchInput,
): string | null {
  if (!isKkcodeIntegration(search)) return null;
  const endpoint = path.replace(/^\/+/, "").replace(/^v1\//, "");
  return `/pg/${endpoint}`;
}
