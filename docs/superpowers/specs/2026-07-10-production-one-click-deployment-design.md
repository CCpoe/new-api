# Production One-Click Deployment Design

## Goal

Provide a repository-managed production deployment path for the `kkcode`
branch. After the repository is cloned or updated, an operator should be able
to run one script that validates the host, preserves the current deployment,
builds the checked-out source, applies application-managed database migrations,
and verifies the resulting service.

The deployment must support a clean Debian 13 host and the existing production
installation without creating a new empty database or replacing local secrets.

## Current Production Baseline

The existing production installation has these properties:

- Repository directory: `/root/new-api`.
- Branch: `kkcode`.
- Compose project: `new-api`.
- Application container: `new-api`.
- PostgreSQL container: `postgres` using the `new-api_pg_data` named volume.
- Redis container: `redis` with no persistent application data requirement.
- Application image: `kkcode-new-api:local`, built from the repository.
- Local configuration: `.env.production` and `docker-compose.prod.yml` are
  excluded through `.git/info/exclude`.
- The application is published on `127.0.0.1:3000` behind an external reverse
  proxy.
- The application performs schema migrations during master-node startup.

The first repository-managed deployment must coexist with the server-local
files above. It must not add tracked files with the same paths, because that
would make the first `git pull` fail on the untracked production files.

## Chosen Approach

Add a self-contained deployment package under `deploy/`:

- `deploy/one-click.sh`: update, backup, build, migrate, and verify orchestration.
- `deploy/docker-compose.prod.yml`: source-build production stack.
- `deploy/.env.production.example`: documented configuration template.
- `deploy/README.md`: first install, upgrade, recovery, and diagnostics.

The script continues to read `/root/new-api/.env.production` by default. A
different path can be selected with `ENV_FILE`.

Keeping the new Compose file under `deploy/` avoids collisions with the
server-local root Compose file. All bind mounts and build contexts use an
absolute repository root supplied by the script, so moving the Compose file
does not move `data/` or `logs/`.

## Host Compatibility

The supported production host is Debian 13 on x86-64. The script should also
work on compatible Debian and Ubuntu releases where the same Docker packages
are available.

The host setup flow is:

1. Require Bash, Git, curl, and standard GNU utilities.
2. Require Docker Compose v2 through `docker compose`.
3. If Docker is absent, install Docker Engine and the Compose plugin through
   the official Docker APT repository when automatic installation is enabled.
4. Verify that the Docker daemon is reachable before touching the deployment.
5. Validate available disk space and warn when memory is below the build
   recommendation.

An already working Docker installation is left unchanged.

## Git Update Flow

The script defaults to `origin/kkcode` and supports `REMOTE` and `BRANCH`
overrides.

Before updating it should:

- acquire an exclusive host lock for the complete deployment run;
- verify that it is running inside the expected repository;
- verify the current branch;
- reject tracked or staged changes;
- allow ignored production configuration and unrelated untracked files;
- fetch the configured branch and require a fast-forward update.

When the script itself changes after the pull, it should execute the updated
copy once before continuing. An environment guard prevents a re-execution
loop.

## Existing Deployment Discovery

Before Compose is invoked, the script inspects the current containers:

- Read `com.docker.compose.project` from the existing application or database
  container and reuse it as `COMPOSE_PROJECT_NAME`.
- Read the volume mounted at `/var/lib/postgresql/data` from the existing
  PostgreSQL container and reuse it as `POSTGRES_VOLUME_NAME`.
- Fall back to `new-api` and `new-api_pg_data` for the known legacy layout.
- Create the default volume only for a genuinely new installation.

The Compose file assigns the detected PostgreSQL volume an explicit name. This
prevents Compose project-directory rules from silently creating a second,
empty database volume.

## Configuration Handling

`.env.production` remains local and untracked. The example file documents at
least:

- `SERVER_ADDRESS`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `SESSION_SECRET`
- `CRYPTO_SECRET`
- `TZ`
- `NODE_NAME`
- optional host port and verification settings

Compose uses required-variable interpolation so missing secrets fail during
preflight rather than halfway through startup.

The deployment script must not print secret values. It should not source the
environment file as arbitrary shell code. Values needed by orchestration are
read as dotenv values, while Compose receives the original file through
`--env-file`.

## Backup and Migration

Every upgrade of an existing PostgreSQL deployment creates a timestamped
directory under `backups/` before the new application starts.

The backup contains:

- a PostgreSQL custom-format dump produced by `pg_dump` inside the existing
  PostgreSQL container, or from a temporary container attached to an existing
  data volume when the original container no longer exists;
- the current Git commit;
- the current container image identifier and Compose project metadata;
- a protected copy of the production environment file;
- copies of legacy SQLite database files when present.

Backup directories and secret-bearing files use restrictive permissions.
Before deployment continues, the dump is fully restored into an isolated
temporary PostgreSQL container and the restored core table counts must match
the source database.

Database schema migration remains owned by the Go application. On master-node
startup, `InitDB` runs the existing cross-database migration path and GORM
`AutoMigrate`. The deployment script does not duplicate schema SQL.

This design preserves and upgrades an existing database within the same
database engine. Automatic SQLite-to-PostgreSQL data conversion is out of
scope; detecting conflicting legacy SQLite data should stop the deployment
with an actionable message instead of starting an empty PostgreSQL instance.

## Deployment Sequence

The normal sequence is:

1. Validate host tools, configuration, repository, and Compose rendering.
2. Pull `origin/kkcode` with fast-forward-only semantics and re-execute the
   updated script when needed.
3. Discover the existing Compose project and PostgreSQL volume.
4. Start or verify PostgreSQL and Redis using the preserved data volume.
5. Create the upgrade backup.
6. Build an application image from the checked-out commit. Both frontend
   themes are built by the existing multi-stage Dockerfile and embedded into
   the Go binary.
7. Start the application and wait for its container health check. Application
   startup performs database migrations before the HTTP service becomes ready.
8. Upsert `ServerAddress` through parameterized `psql` input.
9. Restart the application so the updated setting is immediately visible.
10. Verify the local `/api/status` endpoint and its reported server address.
11. Optionally verify the public HTTPS endpoint.
12. Print the deployed commit, backup location, container state, and service
    URL.

## Failure Handling

The script must never run `docker compose down -v`, delete a named volume, or
remove the previous image during deployment.

On failure it should:

- print the failed stage and relevant application/database log tails;
- print the backup directory and previous image identifier;
- leave PostgreSQL and its volume intact;
- exit non-zero without claiming deployment success.

An automatic application-image rollback is intentionally avoided because a
new application may have already applied a forward database migration. The
documented recovery procedure restores the database backup and previous image
together when a full rollback is required.

## Security

- Do not commit `.env.production`, backups, database files, or credentials.
- Do not pass secrets in command-line arguments when a file, environment, or
  standard input mechanism is available.
- Use parameterized `psql` variables when writing `ServerAddress`.
- Keep the application bound to `127.0.0.1` by default.
- Preserve the existing reverse proxy and TLS boundary.
- Restrict deployment configuration and backup permissions.

## Verification

Repository verification should include:

- `bash -n deploy/one-click.sh`.
- ShellCheck when available.
- `docker compose config` with a non-secret fixture environment.
- Classic and default frontend production builds.
- Go compilation and focused migration tests.
- A complete Docker image build when the local Docker daemon is available.

Production verification should include:

- a successful PostgreSQL dump before replacement;
- reuse of `new-api_pg_data`;
- healthy `postgres`, `redis`, and `new-api` containers;
- local `/api/status` returning `success: true`;
- the expected `server_address` value;
- the deployed container image matching the pushed Git commit;
- preservation of user, option, channel, and token data across the upgrade.

## Commit and Release Structure

Use separate commits so deployment changes can be audited independently:

1. Current classic frontend features and post-merge compatibility fixes.
2. Production one-click deployment package and documentation.

After all verification passes, push the fast-forward `kkcode` history to
`origin/kkcode`, then execute the repository-managed script on production.
