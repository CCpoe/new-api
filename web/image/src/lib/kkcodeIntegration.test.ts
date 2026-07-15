import { describe, expect, it } from "vitest";
import {
  getKkcodeApiUrl,
  getKkcodeRequestHeaders,
  getKkcodeUserId,
  isKkcodeIntegration,
} from "./kkcodeIntegration";
import { applyKkcodeSettings } from "./kkcodeSettings";

const storage = (value: string | null) => ({ getItem: () => value });

describe("KKCode integration", () => {
  it("only enables for the explicit integration mode", () => {
    expect(isKkcodeIntegration("integration=kkcode")).toBe(true);
    expect(isKkcodeIntegration("integration=other")).toBe(false);
  });

  it("reads and validates the shared authenticated user", () => {
    expect(getKkcodeUserId(storage('{"id":42}'))).toBe(42);
    expect(() => getKkcodeUserId(storage('{"id":0}'))).toThrow(
      "登录状态已失效",
    );
    expect(() => getKkcodeUserId(storage("not-json"))).toThrow(
      "登录状态已失效",
    );
  });

  it("uses session headers and playground paths without an API key", () => {
    expect(
      getKkcodeRequestHeaders("integration=kkcode", storage('{"id":42}')),
    ).toEqual({
      "New-Api-User": "42",
    });
    expect(
      getKkcodeApiUrl("/v1/images/generations", "integration=kkcode"),
    ).toBe("/pg/images/generations");
    expect(getKkcodeRequestHeaders("", storage('{"id":42}'))).toBeNull();
    expect(getKkcodeApiUrl("images/generations", "")).toBeNull();
  });

  it("creates a stable active session profile while preserving user options", () => {
    const initial = applyKkcodeSettings(
      {},
      new URLSearchParams("integration=kkcode&kkcodeModel=gpt-image-2"),
    );
    const profile = initial.profiles.find(
      (item) => item.id === initial.activeProfileId,
    );

    expect(profile).toMatchObject({
      id: "kkcode-session",
      name: "KKCode",
      provider: "openai",
      apiKey: "kkcode-session",
      model: "gpt-image-2",
      apiMode: "images",
    });

    const updated = applyKkcodeSettings(
      {
        ...initial,
        profiles: initial.profiles.map((item) =>
          item.id === "kkcode-session"
            ? {
                ...item,
                apiMode: "responses" as const,
                model: "custom-image-model",
              }
            : item,
        ),
      },
      new URLSearchParams("integration=kkcode"),
    );
    const updatedProfile = updated.profiles.find(
      (item) => item.id === updated.activeProfileId,
    );

    expect(updatedProfile).toMatchObject({
      apiMode: "responses",
      model: "custom-image-model",
    });
  });
});
