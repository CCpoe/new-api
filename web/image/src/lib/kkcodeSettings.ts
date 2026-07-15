import type { AppSettings } from "../types";
import { createDefaultOpenAIProfile, normalizeSettings } from "./apiProfiles";
import { isKkcodeIntegration } from "./kkcodeIntegration";

const KKCODE_PROFILE_ID = "kkcode-session";
const KKCODE_PLACEHOLDER_API_KEY = "kkcode-session";
const KKCODE_PLACEHOLDER_BASE_URL = "https://kkcode.invalid/v1";
const DEFAULT_KKCODE_IMAGE_MODEL = "gpt-image-2";

export function applyKkcodeSettings(
  input: Partial<AppSettings> | unknown,
  searchParams: URLSearchParams,
): AppSettings {
  const settings = normalizeSettings(input);
  if (!isKkcodeIntegration(searchParams)) return settings;

  const savedProfile = settings.profiles.find(
    (profile) => profile.id === KKCODE_PROFILE_ID,
  );
  const requestedModel = searchParams.get("kkcodeModel")?.trim();
  const profile = createDefaultOpenAIProfile({
    ...savedProfile,
    id: KKCODE_PROFILE_ID,
    name: "KKCode",
    provider: "openai",
    baseUrl: KKCODE_PLACEHOLDER_BASE_URL,
    apiKey: KKCODE_PLACEHOLDER_API_KEY,
    model: requestedModel || savedProfile?.model || DEFAULT_KKCODE_IMAGE_MODEL,
  });

  const profiles = settings.profiles.some(
    (item) => item.id === KKCODE_PROFILE_ID,
  )
    ? settings.profiles.map((item) =>
        item.id === KKCODE_PROFILE_ID ? profile : item,
      )
    : [...settings.profiles, profile];

  return normalizeSettings({
    ...settings,
    profiles,
    activeProfileId: KKCODE_PROFILE_ID,
  });
}
