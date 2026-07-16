import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultGeminiProfile, normalizeSettings } from "./apiProfiles";
import { buildGeminiGenerateUrl, callGeminiImageApi } from "./geminiImageApi";
import type { CallApiOptions } from "./imageApiShared";
import { DEFAULT_PARAMS, type ApiProfile } from "../types";

function createFixture(
  profileOverrides: Partial<ApiProfile> = {},
  optionOverrides: Partial<CallApiOptions> = {},
) {
  const profile = createDefaultGeminiProfile({
    id: "gemini-test",
    name: "Gemini test",
    baseUrl: "https://new.kkcode.vip/v1beta",
    apiKey: "sk-test",
    timeout: 5,
    ...profileOverrides,
  });
  const settings = normalizeSettings({
    profiles: [profile],
    activeProfileId: profile.id,
  });
  const opts: CallApiOptions = {
    settings,
    prompt: "生成一张测试图片",
    params: { ...DEFAULT_PARAMS, size: "1536x1024" },
    inputImageDataUrls: [],
    ...optionOverrides,
  };
  return { profile, opts };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini image API", () => {
  it("builds a native request with prompt, reference image, and Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: "调整后的描述" },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "AQID",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { search: "?integration=kkcode" } });
    const { profile, opts } = createFixture(
      { model: "models/gemini-2.5-flash-image" },
      {
        inputImageDataUrls: ["data:image/jpeg;base64,BAUG"],
      },
    );

    const result = await callGeminiImageApi(opts, profile);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://new.kkcode.vip/v1beta/models/gemini-2.5-flash-image:generateContent",
    );
    expect(init.headers).toEqual({
      Authorization: "Bearer sk-test",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      contents: [
        {
          role: "user",
          parts: [
            { text: "生成一张测试图片" },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: "BAUG",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "3:2",
        },
      },
    });
    expect(body.generationConfig.imageConfig).not.toHaveProperty("imageSize");
    expect(result).toMatchObject({
      images: ["data:image/png;base64,AQID"],
      revisedPrompts: ["调整后的描述"],
      actualParams: { size: "3:2", n: 1 },
      actualParamsList: [{ size: "3:2", output_format: "png" }],
    });
  });
  it("uses x-goog-api-key outside KKCode integration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "AQID",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { profile, opts } = createFixture();

    await callGeminiImageApi(opts, profile);

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual({
      "x-goog-api-key": "sk-test",
      "Content-Type": "application/json",
    });
  });

  it("maps Gemini 3 high quality to 2K and accepts snake_case output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: " ZmlsZQ== ",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { profile, opts } = createFixture(
      { model: "gemini-3.1-flash-image-preview" },
      {
        params: {
          ...DEFAULT_PARAMS,
          size: "720x1280",
          quality: "high",
        },
      },
    );

    const result = await callGeminiImageApi(opts, profile);

    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    );
    expect(body.generationConfig.imageConfig).toEqual({
      aspectRatio: "9:16",
      imageSize: "2K",
    });
    expect(result.images).toEqual(["data:image/jpeg;base64,ZmlsZQ=="]);
    expect(result.actualParamsList).toEqual([
      { size: "9:16", output_format: "jpeg" },
    ]);
  });

  it("runs bounded multi-image requests and keeps partial successes", async () => {
    let callIndex = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      const index = callIndex++;
      if (index === 1) {
        return jsonResponse({ error: { message: "upstream failed" } }, 500);
      }
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: index === 0 ? "Zmlyc3Q=" : "dGhpcmQ=",
                  },
                },
              ],
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { profile, opts } = createFixture(
      {},
      { params: { ...DEFAULT_PARAMS, n: 3 } },
    );

    const result = await callGeminiImageApi(opts, profile);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.images).toEqual([
      "data:image/png;base64,Zmlyc3Q=",
      "data:image/png;base64,dGhpcmQ=",
    ]);
    expect(result.actualParams?.n).toBe(2);
    expect(result.failedRequests).toEqual([
      { requestIndex: 1, error: "upstream failed" },
    ]);
  });

  it("reports native responses that contain no image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          candidates: [{ finishReason: "SAFETY", content: { parts: [] } }],
          promptFeedback: { blockReason: "SAFETY" },
        }),
      ),
    );
    const { profile, opts } = createFixture();

    await expect(callGeminiImageApi(opts, profile)).rejects.toThrow(
      "Gemini 未返回图片：SAFETY",
    );
  });

  it("rejects mask editing before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { profile, opts } = createFixture(
      {},
      {
        inputImageDataUrls: ["data:image/png;base64,AQID"],
        maskDataUrl: "data:image/png;base64,BAUG",
      },
    );

    await expect(callGeminiImageApi(opts, profile)).rejects.toThrow(
      "Gemini 生图暂不支持蒙版编辑",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes v1 bases and encodes nested model identifiers", () => {
    expect(
      buildGeminiGenerateUrl(
        "https://new.kkcode.vip/v1",
        "models/custom/model",
      ),
    ).toBe(
      "https://new.kkcode.vip/v1beta/models/custom%2Fmodel:generateContent",
    );
  });
});
