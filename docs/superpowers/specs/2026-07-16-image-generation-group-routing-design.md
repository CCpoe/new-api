# Image Generation Group Routing

## Goal

The embedded image-generation workbench should use the platform's `auto`
group by default, allow the user to select any group available to their
account from API settings, and preserve the platform's existing channel,
ratio, quota, settlement, and logging behavior.

## Considered Approaches

1. Add `group` to every JSON or multipart request body. This fits the chat
   playground precedent, but image requests preserve unknown fields and could
   forward the internal group value upstream.
2. Add the group as a query parameter. This works for every request format,
   but exposes routing state in request URLs and logs.
3. Send a dedicated same-origin request header. This works for JSON and
   multipart requests, stays out of upstream payloads, and can be validated in
   one middleware boundary.

The implementation uses approach 3.

## Data Flow

1. The workbench requests `/api/user/self/groups` with the current authenticated
   user header.
2. API settings show the returned groups and ratios in a dropdown. `auto` is
   the initial value for the KKCode session profile.
3. Image and Responses API calls send the selected group in
   `New-Api-Group`.
4. The `/pg` distributor validates the requested group against the current
   user's usable groups. When an image-workbench request has no group header,
   it defaults to `auto` whenever auto routing is available.
5. The selected group enters the existing distributor. Auto routing records
   the concrete selected group in request context, so pre-consume, settlement,
   group-specific ratios, consume logs, and retries continue to use the
   platform's existing billing implementation.

## Compatibility and Safety

- Existing `/pg/chat/completions` body-based group selection remains supported.
- Regular `/v1` token requests ignore the new header.
- Unauthorized or unavailable groups return the existing group-access error.
- No database migration or deployment configuration change is required.

## Verification

- Unit tests cover auto fallback, explicit selection, legacy chat selection,
  unauthorized groups, and isolation from regular relay routes.
- Workbench tests cover persisted default group, request headers, group-list
  loading, and sorting.
- Production builds include Classic, Default, and the image workbench.
