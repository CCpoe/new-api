import { describe, expect, it } from "vitest";
import {
  getKkcodeApiBaseUrl,
  isKkcodeApiProvider,
  isKkcodeIntegration,
  type KkcodeLocation,
} from "./kkcodeIntegration";
import { applyKkcodeSettings } from "./kkcodeSettings";

const location: KkcodeLocation = {
  origin: "https://new.kkcode.vip",
};

describe("KKCode integration", () => {
  it("only enables for the explicit integration mode", () => {
    expect(isKkcodeIntegration("integration=kkcode")).toBe(true);
    expect(isKkcodeIntegration("integration=other")).toBe(false);
  });

  it("derives OpenAI and Gemini API URLs from the current origin", () => {
    expect(getKkcodeApiBaseUrl("openai", location)).toBe(
      "https://new.kkcode.vip/v1",
    );
    expect(getKkcodeApiBaseUrl("gemini", location)).toBe(
      "https://new.kkcode.vip/v1beta",
    );
    expect(getKkcodeApiBaseUrl("openai", null)).toBe("/v1");
    expect(isKkcodeApiProvider("fal")).toBe(false);
  });

  it("creates an API-key profile without session credentials or groups", () => {
    const initial = applyKkcodeSettings(
      {},
      new URLSearchParams("integration=kkcode&kkcodeModel=gpt-image-2"),
      location,
    );
    const profile = initial.profiles.find(
      (item) => item.id === initial.activeProfileId,
    );

    expect(profile).toMatchObject({
      id: "kkcode-session",
      name: "KKCode",
      provider: "openai",
      baseUrl: "https://new.kkcode.vip/v1",
      apiKey: "",
      model: "gpt-image-2",
      apiMode: "images",
      apiProxy: false,
    });
    expect(profile).not.toHaveProperty("group");
  });

  it("preserves the browser-local key and constrains Gemini to its native API", () => {
    const initial = applyKkcodeSettings(
      {},
      new URLSearchParams("integration=kkcode"),
      location,
    );
    const updated = applyKkcodeSettings(
      {
        ...initial,
        profiles: initial.profiles.map((profile) =>
          profile.id === "kkcode-session"
            ? {
                ...profile,
                provider: "gemini" as const,
                baseUrl: "https://untrusted.example/v1",
                apiKey: "sk-browser-local",
                model: "gemini-3.1-flash-image-preview",
                apiMode: "responses" as const,
              }
            : profile,
        ),
      },
      new URLSearchParams("integration=kkcode"),
      location,
    );
    const profile = updated.profiles.find(
      (item) => item.id === updated.activeProfileId,
    );

    expect(profile).toMatchObject({
      provider: "gemini",
      baseUrl: "https://new.kkcode.vip/v1beta",
      apiKey: "sk-browser-local",
      model: "gemini-3.1-flash-image-preview",
      apiMode: "images",
      apiProxy: false,
      streamImages: false,
    });
  });

  it("removes the legacy session placeholder API key", () => {
    const initial = applyKkcodeSettings(
      {},
      new URLSearchParams("integration=kkcode"),
      location,
    );
    const migrated = applyKkcodeSettings(
      {
        ...initial,
        profiles: initial.profiles.map((profile) => ({
          ...profile,
          apiKey: "kkcode-session",
        })),
      },
      new URLSearchParams("integration=kkcode"),
      location,
    );

    expect(
      migrated.profiles.find(
        (profile) => profile.id === migrated.activeProfileId,
      )?.apiKey,
    ).toBe("");
  });
});
