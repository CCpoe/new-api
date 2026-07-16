# Image Generation API Key and Gemini Integration

## Goal

The embedded image-generation workbench should behave like a standalone API
client for the current KKCode deployment. Users enter an API key, the API base
URL is derived from the current browser origin, and the workbench sends normal
token-authenticated relay requests. The page must not select or override a user
group.

The gallery should support both OpenAI-compatible image endpoints and Gemini's
native `generateContent` image protocol without expanding Gemini support into
the Agent workflow.

## Considered Approaches

1. Keep using the authenticated console session and `/pg` routes. This avoids
   asking for an API key, but it preserves the group-specific playground
   behavior that this change is intended to remove.
2. Use only OpenAI-compatible image endpoints and rely on the backend to adapt
   Gemini channels. This is the smallest implementation, but it does not let
   users call the native Gemini image API and cannot represent Gemini-specific
   image input and response shapes cleanly.
3. Use a browser-local API key with separate OpenAI-compatible and native
   Gemini adapters. This matches the requested standalone-client behavior,
   keeps routing and billing inside the existing token pipeline, and limits
   Gemini-specific code to one adapter.

The implementation uses approach 3.

## User Experience

- API settings show a provider selector with `OpenAI` and `Gemini`.
- The API URL is read-only and always derived from `window.location.origin`.
  OpenAI requests use the current origin's `/v1` API, while Gemini requests use
  the same origin's `/v1beta` API internally.
- The API key is entered as a password field with the existing visibility
  control. It is required before submission.
- The API key and selected provider/model are stored only in the workbench's
  browser-local settings. They are not sent to a KKCode settings endpoint or
  stored in the platform database.
- The group selector, connected-account banner, group-list request, and group
  copy are removed from the embedded integration.
- Both Classic and Default console wrappers continue to embed the same image
  workbench and therefore receive identical behavior.

## API Profiles

`gemini` becomes a built-in image provider alongside `openai` and `fal`. The
embedded KKCode profile is normalized to:

- Base URL: the current origin, displayed as `<origin>/v1` for OpenAI and
  `<origin>/v1beta` for Gemini.
- API key: the value saved in browser-local settings.
- OpenAI default model: `gpt-image-2`.
- Gemini default model: `gemini-2.5-flash-image`.
- API proxy: disabled for the same-origin embedded integration.

Provider switching preserves a separate model draft for each provider so a
user can switch protocols without repeatedly re-entering model names. Existing
stored image settings are normalized in place. The prior placeholder API key,
placeholder host, and persisted group field are discarded.

## OpenAI Data Flow

1. The user enters a KKCode API key and submits a gallery task.
2. The workbench sends `Authorization: Bearer <key>` to the current origin.
3. Generation uses `/v1/images/generations`, edits use
   `/v1/images/edits`, and Responses mode uses `/v1/responses`.
4. The regular token authentication and distributor select channels according
   to the token's existing permissions, group, model access, quota, and billing
   configuration.

No `New-Api-User`, `New-Api-Group`, or `/pg` request behavior remains in the
image workbench.

## Gemini Data Flow

1. The workbench sends
   `POST /v1beta/models/{encodedModel}:generateContent` with
   `Authorization: Bearer <key>` and JSON content.
2. The prompt is represented as a Gemini text part. Reference images are
   converted from data URLs into `inlineData` parts with their MIME type and
   base64 payload.
3. The request asks for image output through
   `generationConfig.responseModalities` and supplies supported image settings
   in `generationConfig.imageConfig`.
4. Generated images are read from
   `candidates[].content.parts[].inlineData`. Each image is normalized into the
   workbench's existing data-URL result shape before it reaches the task store.
5. Text parts may be retained as revised-prompt or diagnostic metadata, but do
   not replace an image result. A response with no image part is treated as an
   API error with the returned text included when available.

The current backend already accepts the native Gemini route and token
authentication, so this feature does not add a second proxy or expose upstream
provider credentials.

## Gemini Parameter Compatibility

- Text-to-image and reference-image generation are supported.
- Aspect ratio is derived from the selected size and sent as Gemini
  `imageConfig.aspectRatio` when the size maps to a supported ratio.
- Quality is mapped conservatively: high quality requests use `2K` for Gemini
  3 image models; other requests omit image size and let the model choose its
  supported default.
- Multiple requested images are implemented as bounded concurrent calls,
  matching the existing gallery behavior.
- Output MIME type comes from each Gemini `inlineData` result.

Gemini mode does not support Agent mode, mask editing, transparent-background
post-processing controls, OpenAI moderation settings, output compression,
output-format selection, or partial-image streaming in this iteration. The UI
hides or disables controls that would imply those unsupported guarantees.
Switching to Agent mode requires an OpenAI profile and presents the existing
configuration guidance instead of silently changing protocols.

## Error Handling

- Submission is blocked locally when the API key or model is empty.
- HTTP errors use the existing API error parser, including token, model-access,
  quota, and upstream error messages.
- Malformed Gemini responses retain a bounded raw response payload for
  diagnostics, consistent with current gallery tasks.
- A Gemini response containing only safety or finish metadata reports that no
  image was returned rather than creating an empty successful task.
- API keys are never written to logs, task records, URLs, or exported image
  metadata.

## Removal of Previous Group Routing

This design supersedes
`2026-07-16-image-generation-group-routing-design.md`. Implementation removes
the workbench group field and headers as well as the image-workbench-specific
backend group-resolution middleware and tests introduced for `/pg`. Existing
platform group routing for normal API tokens remains unchanged.

## Verification

- Unit tests cover same-origin URL derivation, browser-local profile
  normalization, provider switching, and removal of session/group headers.
- Gemini adapter tests cover text prompts, reference images, model URL encoding,
  aspect-ratio mapping, multiple candidates, MIME-aware base64 output, empty
  image responses, and API errors.
- Existing OpenAI image and Responses tests continue to pass using Bearer token
  authentication.
- Settings tests verify that API URL is read-only, API key is visible, group UI
  is absent, and Gemini-incompatible controls are unavailable.
- Production builds are run for the image workbench, Classic, and Default
  frontends. Local browser verification covers both wrappers and confirms that
  reloading preserves the API key only in that browser.

## Deployment

The change requires frontend rebuilds because the image workbench bundle is
embedded into the Go application. It requires no database migration and no new
environment variable. Deployment follows the existing production build and
container restart process after local verification and explicit approval.
