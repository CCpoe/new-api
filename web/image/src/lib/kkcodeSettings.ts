import type { ApiProfile, AppSettings } from "../types";
import {
  createDefaultOpenAIProfile,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_IMAGES_MODEL,
  normalizeSettings,
} from "./apiProfiles";
import {
  getKkcodeApiBaseUrl,
  isKkcodeApiProvider,
  isKkcodeIntegration,
  type KkcodeApiProvider,
  type KkcodeLocation,
} from "./kkcodeIntegration";

const KKCODE_PROFILE_ID = "kkcode-session";
const LEGACY_KKCODE_API_KEY = "kkcode-session";

function getKkcodeProvider(profile?: ApiProfile): KkcodeApiProvider {
  return profile && isKkcodeApiProvider(profile.provider)
    ? profile.provider
    : "openai";
}

function getKkcodeDefaultModel(provider: KkcodeApiProvider): string {
  return provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_IMAGES_MODEL;
}

export function applyKkcodeProfileConstraints(
  profile: ApiProfile,
  location?: KkcodeLocation | null,
): ApiProfile {
  const provider = getKkcodeProvider(profile);
  const defaultModel = getKkcodeDefaultModel(provider);

  return {
    ...profile,
    id: KKCODE_PROFILE_ID,
    name: "KKCode",
    provider,
    baseUrl: getKkcodeApiBaseUrl(provider, location),
    apiKey: profile.apiKey === LEGACY_KKCODE_API_KEY ? "" : profile.apiKey,
    model: profile.model.trim() || defaultModel,
    apiMode: provider === "openai" ? profile.apiMode : "images",
    codexCli: provider === "openai" ? profile.codexCli : false,
    apiProxy: false,
    responseFormatB64Json:
      provider === "openai" ? profile.responseFormatB64Json : undefined,
    streamImages: provider === "openai" ? profile.streamImages : false,
  };
}

export function applyKkcodeSettings(
  input: Partial<AppSettings> | unknown,
  searchParams: URLSearchParams,
  location?: KkcodeLocation | null,
): AppSettings {
  const settings = normalizeSettings(input);
  if (!isKkcodeIntegration(searchParams)) return settings;

  const savedProfile = settings.profiles.find(
    (profile) => profile.id === KKCODE_PROFILE_ID,
  );
  const provider = getKkcodeProvider(savedProfile);
  const requestedModel = searchParams.get("kkcodeModel")?.trim();
  const profile = applyKkcodeProfileConstraints(
    createDefaultOpenAIProfile({
      ...savedProfile,
      id: KKCODE_PROFILE_ID,
      name: "KKCode",
      provider,
      apiKey:
        savedProfile?.apiKey === LEGACY_KKCODE_API_KEY
          ? ""
          : (savedProfile?.apiKey ?? ""),
      model:
        requestedModel ||
        savedProfile?.model ||
        getKkcodeDefaultModel(provider),
      apiProxy: false,
    }),
    location,
  );

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
