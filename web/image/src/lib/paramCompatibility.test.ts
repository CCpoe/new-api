import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../types";
import {
  createDefaultGeminiProfile,
  createDefaultFalProfile,
  createDefaultOpenAIProfile,
  DEFAULT_SETTINGS,
  normalizeSettings,
} from "./apiProfiles";
import {
  getOutputImageLimitForSettings,
  normalizeParamsForSettings,
} from "./paramCompatibility";

describe("parameter compatibility", () => {
  it("limits OpenAI output count to 10", () => {
    const openAIProfile = createDefaultOpenAIProfile({
      apiKey: "test-key",
      streamImages: false,
    });
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [openAIProfile],
      activeProfileId: openAIProfile.id,
    });

    expect(getOutputImageLimitForSettings(settings)).toBe(10);
    expect(
      normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 12 }, settings).n,
    ).toBe(10);
  });

  it("limits fal.ai output count to 4", () => {
    const falProfile = createDefaultFalProfile({ apiKey: "fal-key" });
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [falProfile],
      activeProfileId: falProfile.id,
    });

    expect(getOutputImageLimitForSettings(settings)).toBe(4);
    expect(
      normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 8 }, settings).n,
    ).toBe(4);
  });

  it("keeps OpenAI streaming output count so the request can disable streaming", () => {
    const openAIProfile = createDefaultOpenAIProfile({
      apiKey: "test-key",
      streamImages: true,
    });
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [openAIProfile],
      activeProfileId: openAIProfile.id,
    });

    expect(
      normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 4 }, settings).n,
    ).toBe(4);
  });

  it("only replaces fal.ai auto size in text-to-image mode", () => {
    const falProfile = createDefaultFalProfile({ apiKey: "fal-key" });
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [falProfile],
      activeProfileId: falProfile.id,
    });

    expect(
      normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: "auto" }, settings)
        .size,
    ).toBe("1360x1024");
    expect(
      normalizeParamsForSettings(
        { ...DEFAULT_PARAMS, size: "auto" },
        settings,
        { hasInputImages: true },
      ).size,
    ).toBe("auto");
  });

  it("removes unsupported Gemini parameters while preserving image controls", () => {
    const geminiProfile = createDefaultGeminiProfile({ apiKey: "gemini-key" });
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [geminiProfile],
      activeProfileId: geminiProfile.id,
    });

    expect(
      normalizeParamsForSettings(
        {
          ...DEFAULT_PARAMS,
          size: "16:9",
          quality: "high",
          output_format: "webp",
          output_compression: 80,
          moderation: "low",
          transparent_output: true,
          n: 12,
        },
        settings,
      ),
    ).toEqual({
      ...DEFAULT_PARAMS,
      size: "16:9",
      quality: "high",
      n: 10,
    });
  });
});
