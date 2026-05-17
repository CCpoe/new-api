# Wallet Shop Iframe Design

## Goal

Redesign the classic wallet page so users can buy a recharge code from the configured recharge address and redeem that code in the same page. When the shop URL is configured, the page should show the shop in the right side of the wallet screen, while keeping the left side focused on account summary and redemption.

User-facing copy must not mention the third-party shop brand name. Use neutral labels such as "充值地址", "购买充值码", and "打开充值地址".

## Scope

This design applies to the classic frontend wallet page at `web/classic/src/components/topup`. It builds on the existing `lianDongShopUrl` value returned by `/api/user/topup/info`.

No payment callback or payment state polling is needed. Users buy from the embedded or external shop, receive a redemption code from the shop, then redeem it through the existing redemption code flow.

## Layout

Desktop layout should use a 3:7 split:

- Left column: compact recharge module.
- Right column: wide shop iframe panel.

The left column should be narrower than the current wallet card. It should contain:

- Page card header with account recharge title and bill button.
- Three compact account statistic cards in one row: current balance, historical usage, request count.
- A prominent redemption code form.
- A small fallback link/button to open the recharge address when a shop URL exists.

The right column should be visible only when a shop URL exists. It should contain:

- A thin toolbar with neutral title "充值地址".
- Refresh action.
- Open in new window action.
- A wide iframe using the configured shop URL.

The right panel and left card should be visually aligned and have similar height on desktop.

Mobile layout should stack vertically. Recommended order:

1. Compact account statistics.
2. Shop iframe panel when configured.
3. Redemption code form.

This lets mobile users buy first and redeem immediately after.

## Iframe Behavior

The iframe source is the configured recharge address. The browser cannot set a mobile User-Agent per iframe from frontend code. Because the shop does not switch to mobile layout based on width alone, the implementation should favor a wide desktop iframe instead of simulating a phone frame.

The iframe panel should include a loading state while the iframe is loading. If loading fails or the iframe cannot be embedded, show a fallback state with an "打开充值地址" button.

Known browser constraints:

- Frontend code cannot override iframe User-Agent.
- Third-party pages may later block embedding through `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`.
- Cross-origin iframe contents cannot be inspected directly by the app.

## Data Flow

The existing `/api/user/topup/info` response already provides `lian_dong_shop_url`. The wallet page should keep using that value.

When `lianDongShopUrl` is empty:

- Do not render the right iframe panel.
- Keep the wallet page focused on normal online top-up, subscriptions, and redemption code recharge.

When `lianDongShopUrl` is present:

- Render the iframe panel.
- Render a lightweight fallback link in the left column.
- Keep the redemption code form available and prominent.

## Error Handling

Iframe loading should have three user states:

- Loading: show a lightweight skeleton or spinner.
- Loaded: show iframe.
- Failed or blocked: show neutral fallback text and an external open button.

Because cross-origin iframe failures are not always observable, the UI should still provide the external open action in the toolbar even when the iframe appears loaded.

## Visual Rules

Keep the wallet page quiet and task-focused. Avoid large decorative hero-style sections inside the narrow left column. The old blue statistics cover can be replaced by compact cards so the redemption input gets the primary attention.

Keep all new user-facing strings internationalized with `t(...)` and update classic locale files if new keys are introduced.

## Verification

Implementation should be verified with:

- `bun run build` in `web/classic`.
- Browser check on `/console/topup` with a configured recharge address.
- Browser check on `/console/topup` without a configured recharge address.
- Desktop viewport check for 3:7 layout.
- Mobile viewport check for stacked order.
- External-open fallback check.

