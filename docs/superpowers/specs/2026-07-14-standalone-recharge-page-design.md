# Standalone Recharge Page Design

## Goal

Move the configured external recharge shop out of the wallet page and into a dedicated authenticated console page. The new page appears as a `充值` item in the personal-center sidebar and gives the embedded shop the full available content area.

## Scope

- Keep `LianDongShopUrl` as the administrator-managed source of truth.
- Remove the shop iframe panel from `/console/topup` while preserving all native wallet, payment, redemption-code, subscription, and invitation features.
- Add an authenticated `/console/recharge` route.
- Add a `充值` sidebar item between `钱包管理` and `个人设置`.
- Hide the item automatically when `LianDongShopUrl` is empty.
- Allow administrators and users to hide the item through the existing sidebar-module settings.
- Preserve refresh and open-in-new-window actions on the standalone page.

## Backend

Add an authenticated read-only endpoint under the existing user route group:

```text
GET /api/user/recharge-shop
```

Successful response data:

```json
{
  "enabled": true,
  "url": "https://shop.example.com"
}
```

`enabled` is true only when the trimmed `LianDongShopUrl` is non-empty. The endpoint is authenticated so the configured URL is not added to the public status response. Existing option storage and administrator settings remain unchanged.

The existing wallet information response no longer needs to include `lian_dong_shop_url` after all Classic consumers have moved to the new endpoint. Removing it keeps the wallet API focused on wallet and payment configuration.

## Frontend Architecture

### Shared configuration hook

Create a small recharge-shop hook that loads `/api/user/recharge-shop`, normalizes the response, and shares an in-memory request/cache between the sidebar and page. It exposes:

- loading state
- enabled state
- configured URL
- error state
- an explicit reload operation

This prevents the sidebar and page from issuing duplicate requests during the same application session. Reload bypasses the cached request so an administrator can retry after a transient failure.

### Navigation and routing

- Add `recharge: /console/recharge` to the sidebar route map.
- Add `recharge` to the personal section's default administrator configuration.
- Add the module to both administrator and user sidebar-setting forms.
- Render the sidebar item only when the module is permitted and the recharge-shop configuration is enabled.
- Register a lazy-loaded, `PrivateRoute`-protected `/console/recharge` page.

The personal-center order is:

1. `钱包管理`
2. `充值`
3. `个人设置`

### Recharge page

The page uses the full content width and the remaining viewport height inside the existing console layout. It does not use the old wallet card margins, rounded container, or wallet-column layout.

A thin toolbar contains icon controls for:

- reload
- open in a new window

The iframe fills the area below the toolbar and keeps the existing `payment` and `clipboard-write` permissions. The component cleans up timers when it is unmounted.

## States and Error Handling

- **Initial load:** show the standard loading state while configuration is requested.
- **Not configured:** show `充值功能暂未开放`; the sidebar item remains hidden.
- **Configuration request failed:** show a retry action without mounting an iframe.
- **Iframe loading:** show a loading overlay until `onLoad` fires.
- **Iframe timeout:** after 15 seconds, replace the indefinite loading overlay with retry and open-in-new-window actions. The user can still open the configured shop directly.
- **Iframe error:** show the same fallback state immediately.
- **Reload:** remount the iframe with a new key and restart the timeout.

Direct navigation to `/console/recharge` remains safe when the item is hidden: authenticated users see the not-configured state rather than a blank page.

## Internationalization

All new user-facing strings use the existing Classic i18n system and are added for every supported Classic locale. Existing recharge strings should be reused where their meaning is identical.

## Testing

### Backend

- Unauthenticated requests are rejected by the user route middleware.
- An empty option returns `enabled: false` and an empty URL.
- A configured option returns `enabled: true` and the configured URL.

### Frontend and browser verification

- The sidebar item appears only for an authenticated user when the URL is configured and module visibility permits it.
- Administrator and user sidebar visibility settings can hide the item.
- `/console/recharge` renders the full-area iframe and toolbar.
- Refresh remounts the iframe.
- Timeout and error states provide retry and open-in-new-window actions.
- The wallet page no longer mounts or requests the shop iframe.
- Desktop and mobile layouts do not overflow or overlap the console navigation.
- Run the Classic production build and relevant Go tests.

## Deployment

The Auto grouping feature is being developed in parallel and owns currently modified group/token files. This work must not modify or discard those files.

After local implementation and verification:

1. Wait for the Auto grouping task to finish and deploy.
2. Reconcile the latest branch state without overwriting its changes.
3. Commit and push the standalone recharge feature.
4. Run the server's one-click production update script.
5. Verify container health and `/api/status`.
6. Log in and verify the new sidebar item and iframe page.
7. Confirm the old iframe is absent from the wallet page.

Deployment is complete only after the production service has restarted successfully and both the new recharge page and existing wallet behavior have been checked.
