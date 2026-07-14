# Tiered Invitation Rewards

## Goal

Make invitation attribution reliable and reward the inviter at two distinct
milestones:

1. The invited user completes registration: reward the inviter $2.
2. The invited user completes their first eligible online top-up: reward the
   inviter another $2.

Do not compensate or backfill historical users. Redemption codes, direct
administrator quota adjustments, invitation reward transfers, and subscription
purchases are not eligible top-ups.

## Current Failure

The production invitation URL contained a valid affiliate code, but the
password registration request did not reliably preserve that code. The created
user therefore had `inviter_id = 0`, and no invitation reward was recorded.
The configured reward and payment compliance confirmation were both active.

The current reward settlement also runs after user creation, ignores settlement
errors, and has no durable idempotency record. That makes it unsuitable for a
second reward triggered by payment webhooks, which can be delivered more than
once.

## Reward Configuration

- Keep `QuotaForInviter` as the registration reward.
- Add `QuotaForInviterFirstTopUp` as the first eligible top-up reward.
- Keep `QuotaForInvitee` unchanged; it remains the optional quota awarded to
  the invited user at registration.
- Expose both inviter reward values from the authenticated top-up information
  endpoint as raw quota values.
- Add the new first-top-up setting to both administration frontends.

Production will set `QuotaForInviter` and `QuotaForInviterFirstTopUp` to the
quota equivalents of $2. Reward events store the granted quota snapshot, so
later configuration changes do not alter historical rewards.

## Attribution And Registration

The Classic registration page captures the affiliate code once from the URL,
falls back to the stored affiliate code, and sends an immutable registration
payload containing `aff_code`. The registration endpoint also accepts the
affiliate code query parameter as a compatibility fallback for stale frontend
bundles.

When the code resolves to a valid inviter, user creation, `inviter_id`
assignment, invitation count increment, registration reward event creation,
and inviter quota updates occur in one database transaction. A failure rolls
back the complete operation instead of silently creating an unattributed or
partially rewarded registration.

The affiliate code is removed from browser storage after successful
registration so a later unrelated registration is not attributed to a stale
inviter.

## Reward Ledger

Add an invitation reward event model with these fields:

- inviter user ID
- invited user ID
- reward kind (`registration` or `first_topup`)
- granted quota
- related trade number when applicable
- creation timestamp

A unique index on invited user ID and reward kind guarantees that each
milestone can be rewarded at most once. Insertion uses GORM conflict handling
so SQLite, MySQL, and PostgreSQL receive equivalent behavior.

The inviter's available invitation quota and historical invitation quota are
updated in the same transaction as the event. System logs are written after a
successful commit and identify the milestone and invited user.

## First Top-Up Settlement

Eligible providers are Epay, official Alipay, Lakala, Stripe, Creem, Waffo, and
Waffo Pancake. Their successful one-time top-up transactions call one shared
invitation reward settlement function before commit.

The function:

1. Reads the top-up user and verifies a valid inviter relationship.
2. Verifies payment compliance and a positive first-top-up reward setting.
3. Checks for an earlier successful eligible top-up, excluding the current
   order, so pre-existing payment history is respected after rollout.
4. Inserts the unique `first_topup` reward event.
5. Updates the inviter's available and historical invitation quota only when
   the event insertion succeeds.

Repeated callbacks and concurrent first-payment callbacks cannot grant the
reward twice. The top-up credit, reward event, and inviter quota update commit
or roll back together.

Subscription order settlement, redemption, direct quota adjustment, and
invitation quota transfer remain outside this path.

## Invitation Card

Both wallet frontends consume the two reward values from the top-up information
response and format them using the active quota display mode. The invitation
card prominently displays:

- registration success reward
- first online top-up reward
- maximum reward per invited user, calculated as their sum

Existing pending reward, total reward, invite count, copy-link, and transfer
controls remain unchanged. Loading and zero-value states render valid amounts
without hard-coded currency text.

All new user-facing strings are translated for every locale supported by each
frontend.

## Testing

Backend regression coverage verifies:

- a body affiliate code and query fallback both create the inviter relation;
- registration reward, invitation count, and reward event commit together;
- invalid or absent codes do not grant rewards;
- the first eligible top-up grants exactly one reward;
- repeated and concurrent callbacks cannot grant a duplicate reward;
- a second successful top-up does not grant a reward;
- users with successful top-ups before rollout do not receive a later
  first-top-up reward;
- users without an inviter receive no reward;
- ineligible funding paths do not invoke first-top-up settlement.

Frontend verification covers dynamic reward values, zero values, responsive
layout, and successful Classic and Default production builds.

## Deployment

1. Run database migrations to create the reward event table.
2. Deploy the application without modifying historical invitation relations or
   balances.
3. Set both production inviter reward options to the quota equivalent of $2.
4. Restart the service so the new option is loaded.
5. Verify the registration and first-top-up flows with controlled test data,
   including callback replay, before production deployment.
6. In production, confirm the configured reward values and displayed reward
   details without creating historical compensation entries.
7. Verify container health, `/api/status`, and both wallet routes.

## Rollback

Code can be rolled back while leaving the reward ledger table in place. The
table is additive and ignored by older binaries. Reward events and granted
quota already committed before rollback remain valid financial records and are
not automatically reversed.
