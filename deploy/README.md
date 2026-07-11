# Production deployment

This directory contains the repository-managed production deployment for the
`kkcode` branch. It builds the checked-out source, preserves the existing
PostgreSQL volume, creates an upgrade backup, and waits for application-managed
schema migrations before reporting success.

## Existing server upgrade

Keep the existing root `.env.production` file. The old root
`docker-compose.prod.yml` and `update-and-start.sh` may remain in place; the new
deployment uses files under `deploy/` and does not overwrite them.

```bash
cd /root/new-api
git pull --ff-only origin kkcode
bash deploy/one-click.sh
```

Run a non-mutating deployment preflight with:

```bash
bash deploy/one-click.sh --check
```

The preflight may update the Git branch unless `SKIP_GIT_UPDATE=true` is set,
but it does not build images, restart containers, or modify the database.

The script detects the Compose project, Docker network, and PostgreSQL volume
from the running containers. For the known production layout it reuses:

- Compose project `new-api`
- network `new-api_new-api-network`
- PostgreSQL volume `new-api_pg_data`

## New server

```bash
cp deploy/.env.production.example .env.production
chmod 600 .env.production
editor .env.production
bash deploy/one-click.sh
```

On Debian or Ubuntu, missing Docker packages can be installed automatically
when the script runs as root. Use `sudo bash deploy/one-click.sh` on a new host.
Set `AUTO_INSTALL_DEPS=false` to require all host dependencies to be installed
in advance. Docker Compose v2 is required.

## Upgrade behavior

Every upgrade with an existing PostgreSQL container writes a timestamped backup
under `backups/`. It contains a custom-format PostgreSQL dump, a validated dump
manifest, the previous commit and container metadata, the protected environment
file, and core table counts before and after deployment. The dump is fully
restored into an isolated temporary PostgreSQL container, and its core table
counts must match before deployment continues.

The Go application owns database schema migration. The deployment waits for the
application health check, which only becomes healthy after startup migrations
complete.

The script never removes Docker volumes and never runs `down -v`.
An exclusive `.deploy.lock` prevents concurrent updates, backups, builds, and
migrations in the same repository.

## Useful overrides

```bash
REMOTE=origin BRANCH=kkcode bash deploy/one-click.sh
SKIP_GIT_UPDATE=true bash deploy/one-click.sh
VERIFY_EXTERNAL=false bash deploy/one-click.sh
HEALTH_TIMEOUT=600 bash deploy/one-click.sh
```

`VERIFY_EXTERNAL=false` skips the public DNS/TLS check but still requires the
local status endpoint and expected `ServerAddress` value.

## Recovery

If deployment fails, inspect the log tail printed by the script and the backup
path in the error output. Do not delete or recreate `new-api_pg_data`.

A full rollback must restore the matching database dump and application image
together because a newer application may have already applied a forward schema
migration. Stop the application before restoring a dump, and verify the target
backup path and database name before running any destructive restore command.

Legacy SQLite files are copied into upgrade backups when PostgreSQL already
exists. If SQLite data is found but no PostgreSQL volume exists, deployment
stops instead of silently starting an empty PostgreSQL database; cross-engine
data import must be performed explicitly.
