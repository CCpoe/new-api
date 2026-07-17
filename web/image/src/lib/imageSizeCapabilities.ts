import type { ApiProfile } from "../types";
import { KKCODE_PROFILE_ID } from "./kkcodeSettings";
import { normalizeImageSize, parseRatio } from "./size";

export interface FixedImageSizePreset {
  ratio: string;
  size: string;
}

export const CLI_PROXY_GPT_IMAGE_2_SIZE_PRESETS = [
  { ratio: "1:1", size: "1024x1024" },
  { ratio: "3:2", size: "1536x1024" },
  { ratio: "2:3", size: "1024x1536" },
] as const satisfies readonly FixedImageSizePreset[];

export const GEMINI_25_IMAGE_SIZE_PRESETS = [
  { ratio: "1:1", size: "1024x1024" },
  { ratio: "2:3", size: "832x1248" },
  { ratio: "3:2", size: "1248x832" },
  { ratio: "3:4", size: "864x1184" },
  { ratio: "4:3", size: "1184x864" },
  { ratio: "4:5", size: "896x1152" },
  { ratio: "5:4", size: "1152x896" },
  { ratio: "9:16", size: "768x1344" },
  { ratio: "16:9", size: "1344x768" },
  { ratio: "21:9", size: "1536x672" },
] as const satisfies readonly FixedImageSizePreset[];

function getBaseModelName(model: string) {
  const normalized = model
    .trim()
    .toLowerCase()
    .replace(/^models\//, "");
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
}

export function isGemini25ImageModel(model: string) {
  return getBaseModelName(model) === "gemini-2.5-flash-image";
}

function isGptImage2Model(model: string) {
  return getBaseModelName(model) === "gpt-image-2";
}

export function getFixedImageSizePresets(
  profile: ApiProfile,
): readonly FixedImageSizePreset[] | null {
  if (profile.provider === "gemini" && isGemini25ImageModel(profile.model)) {
    return GEMINI_25_IMAGE_SIZE_PRESETS;
  }

  if (
    profile.id === KKCODE_PROFILE_ID &&
    profile.provider === "openai" &&
    isGptImage2Model(profile.model)
  ) {
    return CLI_PROXY_GPT_IMAGE_2_SIZE_PRESETS;
  }

  return null;
}

export function findClosestFixedImageSizePreset(
  size: string,
  presets: readonly FixedImageSizePreset[],
): FixedImageSizePreset | undefined {
  const normalized = normalizeImageSize(size);
  const exact = presets.find((preset) => preset.size === normalized);
  if (exact) return exact;

  const requested = parseRatio(normalized);
  if (!requested) return undefined;
  const requestedRatio = requested.width / requested.height;

  return presets
    .map((preset) => {
      const ratio = parseRatio(preset.ratio);
      return {
        preset,
        distance: ratio
          ? Math.abs(Math.log(requestedRatio / (ratio.width / ratio.height)))
          : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.preset;
}

export function normalizeImageSizeForProfile(
  size: string,
  profile: ApiProfile,
) {
  const normalized = normalizeImageSize(size);
  const presets = getFixedImageSizePresets(profile);
  if (!presets || !normalized || normalized === "auto") return normalized;

  return findClosestFixedImageSizePreset(normalized, presets)?.size ?? "auto";
}
