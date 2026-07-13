# Auto Group Default and Token Migration

## Context

The production instance has `DefaultUseAutoGroup` enabled and a populated
`AutoGroups` chain, but manually created tokens are still saved with an empty
group. The Classic token form initializes the group as empty, the token create
endpoint preserves that empty value, and the user-group endpoint only exposes
`auto` when it is manually present in `UserUsableGroups`.

Because production has no channels in the `default` group, an empty-group token
inherits the user's `default` group and `/v1/models` returns an empty list.

## Behavior

1. When `DefaultUseAutoGroup` is enabled, the user-group endpoint exposes the
   virtual `auto` option whenever the user has at least one accessible group in
   the configured auto-group chain.
2. When a token is created with an empty group while
   `DefaultUseAutoGroup` is enabled, the backend stores `auto`. Explicitly
   selected groups remain unchanged.
3. The Classic token form displays `auto` as the initial selection when the
   setting is enabled. The backend remains authoritative for API clients and
   stale frontend bundles.
4. Existing production tokens whose group is null or empty are migrated to
   `auto`. Other token fields, including `cross_group_retry`, are preserved.

## Compatibility

- Disabling `DefaultUseAutoGroup` preserves the existing empty-group behavior.
- Editing an existing token does not silently change its group unless the user
  submits a new value.
- `auto` remains a virtual routing group; channels continue to use concrete
  group names.
- Actual routing and billing continue to use the concrete group selected from
  the configured auto-group chain.

## Verification

- Controller tests cover empty-group token creation with the setting enabled
  and disabled.
- Controller tests cover visibility of `auto` only when the user has an
  accessible configured auto group.
- The Classic production build must succeed.
- After deployment and migration, the affected token must return a non-empty
  `/v1/models` response, and the database must contain no null or empty token
  groups.

## Rollback

The code changes can be reverted independently. The one-time data migration is
reversible only by explicitly choosing which tokens should return to an empty
group, so the migration count and affected token IDs must be recorded before
updating production.
