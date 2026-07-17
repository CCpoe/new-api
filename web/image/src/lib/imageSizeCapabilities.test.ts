import { describe, expect, it } from "vitest";
import {
  createDefaultGeminiProfile,
  createDefaultOpenAIProfile,
} from "./apiProfiles";
import {
  CLI_PROXY_GPT_IMAGE_2_SIZE_PRESETS,
  GEMINI_25_IMAGE_SIZE_PRESETS,
  getFixedImageSizePresets,
  normalizeImageSizeForProfile,
} from "./imageSizeCapabilities";
import { KKCODE_PROFILE_ID } from "./kkcodeSettings";

describe("image size capabilities", () => {
  it("limits KKCode gpt-image-2 to CLIProxyAPI hosted tool sizes", () => {
    const profile = createDefaultOpenAIProfile({
      id: KKCODE_PROFILE_ID,
      model: "gpt-image-2",
    });

    expect(getFixedImageSizePresets(profile)).toBe(
      CLI_PROXY_GPT_IMAGE_2_SIZE_PRESETS,
    );
    expect(normalizeImageSizeForProfile("2160x3840", profile)).toBe(
      "1024x1536",
    );
    expect(normalizeImageSizeForProfile("1536x1024", profile)).toBe(
      "1536x1024",
    );
  });

  it("keeps flexible GPT Image 2 sizes for direct OpenAI profiles", () => {
    const profile = createDefaultOpenAIProfile({
      id: "direct-openai",
      model: "gpt-image-2",
    });

    expect(getFixedImageSizePresets(profile)).toBeNull();
    expect(normalizeImageSizeForProfile("2160x3840", profile)).toBe(
      "2160x3840",
    );
  });

  it("maps Gemini 2.5 requests to its fixed 1K output table", () => {
    const profile = createDefaultGeminiProfile({
      model: "models/gemini-2.5-flash-image",
    });

    expect(getFixedImageSizePresets(profile)).toBe(
      GEMINI_25_IMAGE_SIZE_PRESETS,
    );
    expect(normalizeImageSizeForProfile("2160x3840", profile)).toBe("768x1344");
    expect(normalizeImageSizeForProfile("16:9", profile)).toBe("1344x768");
  });

  it("leaves newer Gemini image models on the generic size picker", () => {
    const profile = createDefaultGeminiProfile({
      model: "gemini-3.1-flash-image-preview",
    });

    expect(getFixedImageSizePresets(profile)).toBeNull();
    expect(normalizeImageSizeForProfile("2160x3840", profile)).toBe(
      "2160x3840",
    );
  });
});
