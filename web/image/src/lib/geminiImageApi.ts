import type { ApiProfile, TaskParams } from "../types";
import type { CallApiOptions, CallApiResult } from "./imageApiShared";
import {
  assertImageInputPayloadSize,
  getApiErrorMessage,
  getDataUrlEncodedByteSize,
  mergeActualParams,
  normalizeBase64Image,
} from "./imageApiShared";
import { parseRatio } from "./size";
import { isKkcodeIntegration } from "./kkcodeIntegration";

const MAX_GEMINI_OUTPUT_IMAGES = 10;
const GEMINI_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "1:4",
  "1:8",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "4:1",
  "5:4",
  "9:16",
  "8:1",
  "16:9",
  "21:9",
] as const;

interface GeminiInlineData {
  mimeType?: string;
  mime_type?: string;
  data?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
  finish_reason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
  prompt_feedback?: {
    block_reason?: string;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeGeminiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "/v1beta";
  if (/\/v1beta$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return trimmed.replace(/\/v1$/i, "/v1beta");
  return `${trimmed}/v1beta`;
}

export function buildGeminiGenerateUrl(baseUrl: string, model: string): string {
  const normalizedModel = model.trim().replace(/^models\//i, "");
  return `${normalizeGeminiBaseUrl(baseUrl)}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

function getGeminiAspectRatio(size: string): string | undefined {
  if (!size.trim() || size === "auto") return undefined;
  const parsed = parseRatio(size);
  if (!parsed) return undefined;

  const requestedRatio = parsed.width / parsed.height;
  return GEMINI_ASPECT_RATIOS.map((value) => {
    const ratio = parseRatio(value);
    return {
      value,
      distance: ratio
        ? Math.abs(Math.log(requestedRatio / (ratio.width / ratio.height)))
        : Number.POSITIVE_INFINITY,
    };
  }).sort((a, b) => a.distance - b.distance)[0]?.value;
}

function getGeminiImageSize(
  model: string,
  quality: TaskParams["quality"],
): string | undefined {
  return /^gemini-3(?:\.|-)/i.test(model.trim()) && quality === "high"
    ? "2K"
    : undefined;
}

function parseInputImage(dataUrl: string): GeminiPart {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error("Gemini 参考图必须是 Base64 data URL");
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2].replace(/\s/g, ""),
    },
  };
}

function getOutputFormat(
  mimeType: string,
): TaskParams["output_format"] | undefined {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/webp") return "webp";
  return undefined;
}

function parseGeminiResponse(
  payload: GeminiResponse,
  params: TaskParams,
): CallApiResult {
  const images: string[] = [];
  const revisedPrompts: Array<string | undefined> = [];
  const actualParamsList: Array<Partial<TaskParams> | undefined> = [];
  const aspectRatio = getGeminiAspectRatio(params.size);
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates
    : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate.content?.parts)
      ? candidate.content.parts
      : [];
    const responseText =
      parts
        .map((part) => part.text?.trim())
        .filter((text): text is string => Boolean(text))
        .join("\n") || undefined;

    for (const part of parts) {
      const inlineData = part.inlineData ?? part.inline_data;
      const data = inlineData?.data?.trim();
      if (!data) continue;

      const mimeType =
        inlineData?.mimeType?.trim() ||
        inlineData?.mime_type?.trim() ||
        "image/png";
      images.push(normalizeBase64Image(data, mimeType));
      revisedPrompts.push(responseText);
      actualParamsList.push(
        mergeActualParams(
          aspectRatio ? { size: aspectRatio } : undefined,
          getOutputFormat(mimeType)
            ? { output_format: getOutputFormat(mimeType) }
            : undefined,
        ),
      );
    }
  }

  if (images.length === 0) {
    const text = candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join("\n");
    const finishReasons = candidates
      .map((candidate) => candidate.finishReason ?? candidate.finish_reason)
      .filter((value): value is string => Boolean(value))
      .join(", ");
    const blockReason =
      payload.promptFeedback?.blockReason ??
      payload.prompt_feedback?.block_reason;
    const detail = text || blockReason || finishReasons;
    throw new Error(
      detail ? `Gemini 未返回图片：${detail}` : "Gemini 未返回图片",
    );
  }

  return {
    images,
    actualParams: mergeActualParams(
      aspectRatio ? { size: aspectRatio } : undefined,
      { n: images.length },
    ),
    actualParamsList,
    revisedPrompts,
  };
}

async function callGeminiImageApiSingle(
  opts: CallApiOptions,
  profile: ApiProfile,
): Promise<CallApiResult> {
  if (opts.maskDataUrl) {
    throw new Error("Gemini 生图暂不支持蒙版编辑");
  }

  assertImageInputPayloadSize(
    opts.inputImageDataUrls.reduce(
      (sum, dataUrl) => sum + getDataUrlEncodedByteSize(dataUrl),
      0,
    ),
  );

  const aspectRatio = getGeminiAspectRatio(opts.params.size);
  const imageSize = getGeminiImageSize(profile.model, opts.params.quality);
  const imageConfig = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageSize ? { imageSize } : {}),
  };
  const parts: GeminiPart[] = [
    { text: opts.prompt },
    ...opts.inputImageDataUrls.map(parseInputImage),
  ];
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    profile.timeout * 1000,
  );

  try {
    const response = await fetch(
      buildGeminiGenerateUrl(profile.baseUrl, profile.model),
      {
        method: "POST",
        headers: isKkcodeIntegration()
          ? {
              Authorization: `Bearer ${profile.apiKey.trim()}`,
              "Content-Type": "application/json",
            }
          : {
              "x-goog-api-key": profile.apiKey.trim(),
              "Content-Type": "application/json",
            },
        cache: "no-store",
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return parseGeminiResponse(
      (await response.json()) as GeminiResponse,
      opts.params,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callGeminiImageApi(
  opts: CallApiOptions,
  profile: ApiProfile,
): Promise<CallApiResult> {
  const count = Math.min(
    MAX_GEMINI_OUTPUT_IMAGES,
    Math.max(1, Math.trunc(opts.params.n || 1)),
  );
  if (count === 1) {
    return callGeminiImageApiSingle(
      {
        ...opts,
        params: { ...opts.params, n: 1 },
      },
      profile,
    );
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, requestIndex) =>
      callGeminiImageApiSingle(
        {
          ...opts,
          params: { ...opts.params, n: 1 },
          onPartialImage: opts.onPartialImage
            ? (partial) => opts.onPartialImage?.({ ...partial, requestIndex })
            : undefined,
        },
        profile,
      ),
    ),
  );
  const successful = results
    .filter(
      (result): result is PromiseFulfilledResult<CallApiResult> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const failedRequests = results.flatMap((result, requestIndex) =>
    result.status === "rejected"
      ? [{ requestIndex, error: getErrorMessage(result.reason) }]
      : [],
  );

  if (successful.length === 0) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (firstFailure) throw firstFailure.reason;
    throw new Error("所有 Gemini 生图请求均失败");
  }

  const images = successful.flatMap((result) => result.images);
  return {
    images,
    actualParams: mergeActualParams(successful[0]?.actualParams, {
      n: images.length,
    }),
    actualParamsList: successful.flatMap(
      (result) =>
        result.actualParamsList ?? result.images.map(() => result.actualParams),
    ),
    revisedPrompts: successful.flatMap(
      (result) => result.revisedPrompts ?? result.images.map(() => undefined),
    ),
    ...(failedRequests.length ? { failedRequests } : {}),
  };
}
