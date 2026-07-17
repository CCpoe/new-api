import { describe, expect, it } from "vitest";
import {
  createDefaultFalProfile,
  createDefaultOpenAIProfile,
} from "./apiProfiles";
import {
  applyKkcodeSettings,
  KKCODE_PROFILE_ID,
  removeFalProviderSettings,
} from "./kkcodeSettings";

describe("KKCode settings", () => {
  it("deduplicates persisted profiles with the same ID", () => {
    const first = createDefaultOpenAIProfile({
      id: KKCODE_PROFILE_ID,
      name: "KKCode",
      apiKey: "first-key",
    });
    const duplicate = createDefaultOpenAIProfile({
      id: KKCODE_PROFILE_ID,
      name: "KKCode",
      apiKey: "duplicate-key",
    });

    const settings = applyKkcodeSettings(
      {
        profiles: [first, duplicate],
        activeProfileId: KKCODE_PROFILE_ID,
      },
      new URLSearchParams("integration=kkcode"),
    );

    expect(
      settings.profiles.filter((profile) => profile.id === KKCODE_PROFILE_ID),
    ).toHaveLength(1);
    expect(settings.profiles[0].apiKey).toBe("first-key");
  });

  it("deduplicates canonical and copied KKCode profiles outside integration mode", () => {
    const canonical = createDefaultOpenAIProfile({
      id: KKCODE_PROFILE_ID,
      name: "KKCode",
      apiKey: "canonical-key",
    });
    const copied = createDefaultOpenAIProfile({
      id: "kkcode-copy",
      name: "KKCode",
      apiKey: "copied-key",
    });

    const settings = applyKkcodeSettings(
      {
        profiles: [copied, canonical],
        activeProfileId: copied.id,
      },
      new URLSearchParams(),
    );

    expect(settings.profiles).toHaveLength(1);
    expect(settings.profiles[0].id).toBe(KKCODE_PROFILE_ID);
    expect(settings.profiles[0].apiKey).toBe("canonical-key");
  });

  it("keeps only the canonical KKCode profile in integration mode", () => {
    const canonical = createDefaultOpenAIProfile({
      id: KKCODE_PROFILE_ID,
      name: "KKCode",
    });
    const copied = createDefaultOpenAIProfile({
      id: "kkcode-copy",
      name: "KKCode",
    });
    const other = createDefaultOpenAIProfile({
      id: "other-profile",
      name: "Other",
    });

    const settings = applyKkcodeSettings(
      {
        profiles: [canonical, copied, other],
        activeProfileId: KKCODE_PROFILE_ID,
      },
      new URLSearchParams("integration=kkcode"),
    );

    expect(settings.profiles.map((profile) => profile.name)).toEqual([
      "Other",
      "KKCode",
    ]);
  });

  it("removes persisted fal profiles and provider drafts", () => {
    const openAI = createDefaultOpenAIProfile({
      id: "openai-profile",
      providerDrafts: {
        fal: {
          baseUrl: "https://fal.run",
          model: "openai/gpt-image-2",
        },
      },
    });
    const fal = createDefaultFalProfile({ id: "fal-profile" });

    const settings = removeFalProviderSettings({
      profiles: [fal, openAI],
      activeProfileId: fal.id,
      providerOrder: ["fal", "gemini", "openai"],
    });

    expect(settings.profiles).toHaveLength(1);
    expect(settings.profiles[0].id).toBe(openAI.id);
    expect(settings.profiles[0].providerDrafts?.fal).toBeUndefined();
    expect(settings.activeProfileId).toBe(openAI.id);
    expect(settings.providerOrder).toEqual(["gemini", "openai"]);
  });

  it("restores the default OpenAI profile when fal was the only profile", () => {
    const fal = createDefaultFalProfile({ id: "fal-only" });

    const settings = removeFalProviderSettings({
      profiles: [fal],
      activeProfileId: fal.id,
    });

    expect(settings.profiles).toHaveLength(1);
    expect(settings.profiles[0].provider).toBe("openai");
  });
});
