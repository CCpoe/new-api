#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SCRIPT_PATH="$SCRIPT_DIR/one-click.sh"
ORIGINAL_ARGS=("$@")

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-kkcode}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.prod.yml}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"
AUTO_INSTALL_DEPS="${AUTO_INSTALL_DEPS:-true}"
SKIP_GIT_UPDATE="${SKIP_GIT_UPDATE:-false}"
VERIFY_EXTERNAL="${VERIFY_EXTERNAL:-}"

CURRENT_STAGE="initialization"
BACKUP_DIR=""
SERVER_ADDRESS="${SERVER_ADDRESS:-}"
HOST_PORT="${HOST_PORT:-}"
COMPOSE_CMD=()
SUDO=()
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
POSTGRES_VOLUME_NAME="${POSTGRES_VOLUME_NAME:-}"
NETWORK_NAME="${NETWORK_NAME:-}"
CHECK_ONLY=false
POSTGRES_IMAGE="${POSTGRES_IMAGE:-}"
BACKUP_SOURCE_CONTAINER=""
TEMP_BACKUP_CONTAINER=""
VALIDATION_CONTAINER=""
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$REPO_ROOT/.deploy.lock}"

case "$ENV_FILE" in
  /*) ;;
  *) ENV_FILE="$REPO_ROOT/$ENV_FILE" ;;
esac

case "$COMPOSE_FILE" in
  /*) ;;
  *) COMPOSE_FILE="$REPO_ROOT/$COMPOSE_FILE" ;;
esac

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf '[%s] ERROR (%s): %s\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$CURRENT_STAGE" "$*" >&2
  if [[ -n "$BACKUP_DIR" ]]; then
    printf 'Backup preserved at: %s\n' "$BACKUP_DIR" >&2
  fi
  cleanup_temp_containers
  exit 1
}

quote_command() {
  local output=""
  local arg
  for arg in "$@"; do
    printf -v output '%s%q ' "$output" "$arg"
  done
  printf '%s' "${output% }"
}

run() {
  log "+ $(quote_command "$@")"
  "$@"
}

is_true() {
  case "${1,,}" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

on_error() {
  local rc=$?
  trap - ERR
  set +e
  printf '[%s] ERROR: deployment failed during %s (exit %s)\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$CURRENT_STAGE" "$rc" >&2
  cleanup_temp_containers
  if [[ ${#COMPOSE_CMD[@]} -gt 0 && -n "$COMPOSE_PROJECT_NAME" && -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]]; then
    compose logs --tail=120 new-api postgres redis >&2 2>/dev/null || true
  fi
  if [[ -n "$BACKUP_DIR" ]]; then
    printf 'Backup preserved at: %s\n' "$BACKUP_DIR" >&2
  fi
  exit "$rc"
}

trap on_error ERR

cleanup_temp_containers() {
  command -v docker >/dev/null 2>&1 || return
  if [[ -n "$VALIDATION_CONTAINER" ]]; then
    docker rm -f "$VALIDATION_CONTAINER" >/dev/null 2>&1 || true
    VALIDATION_CONTAINER=""
  fi
  if [[ -n "$TEMP_BACKUP_CONTAINER" ]]; then
    docker rm -f "$TEMP_BACKUP_CONTAINER" >/dev/null 2>&1 || true
    TEMP_BACKUP_CONTAINER=""
  fi
}

parse_arguments() {
  local argument
  for argument in "$@"; do
    case "$argument" in
      --check) CHECK_ONLY=true ;;
      *) die "unknown argument: $argument" ;;
    esac
  done
}

acquire_deployment_lock() {
  command -v flock >/dev/null 2>&1 || die "flock is required (install util-linux)"
  if [[ "${DEPLOY_LOCK_HELD:-0}" == "1" ]]; then
    return
  fi

  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || die "another deployment is already running"
  export DEPLOY_LOCK_HELD=1
  log "acquired deployment lock: $DEPLOY_LOCK_FILE"
}

as_root() {
  "${SUDO[@]}" "$@"
}

configure_privilege() {
  if ((EUID == 0)); then
    SUDO=()
    return
  fi
  command -v sudo >/dev/null 2>&1 || die "sudo is required when not running as root"
  SUDO=(sudo)
}

install_base_dependencies() {
  local missing=()
  local command_name
  for command_name in git curl; do
    command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
  done
  if ((${#missing[@]} == 0)); then
    return
  fi
  is_true "$AUTO_INSTALL_DEPS" || die "missing commands: ${missing[*]}"
  command -v apt-get >/dev/null 2>&1 || die "automatic dependency installation requires apt-get"
  CURRENT_STAGE="installing base dependencies"
  run as_root apt-get update
  run as_root apt-get install -y ca-certificates curl git gnupg
}

install_docker() {
  command -v docker >/dev/null 2>&1 && return
  is_true "$AUTO_INSTALL_DEPS" || die "Docker is not installed"
  ((EUID == 0)) || die "Docker is missing; rerun this script with sudo for automatic installation"
  [[ -r /etc/os-release ]] || die "cannot identify the Linux distribution"

  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    debian | ubuntu) ;;
    *) die "automatic Docker installation supports Debian and Ubuntu only" ;;
  esac

  CURRENT_STAGE="installing Docker"
  run as_root install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" |
    as_root gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  as_root chmod a+r /etc/apt/keyrings/docker.gpg

  local architecture
  architecture="$(dpkg --print-architecture)"
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
    "$architecture" "$ID" "${VERSION_CODENAME:?VERSION_CODENAME is missing}" |
    as_root tee /etc/apt/sources.list.d/docker.list >/dev/null

  run as_root apt-get update
  run as_root apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  run as_root systemctl enable --now docker
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  else
    die "Docker Compose v2 is required; install the docker-compose-plugin package"
  fi
  docker info >/dev/null 2>&1 || die "Docker daemon is not reachable"
}

compose() {
  "${COMPOSE_CMD[@]}" \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" "$@"
}

dotenv_get() {
  local key="$1"
  local line=""
  local value=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*=(.*)$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
  done <"$ENV_FILE"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  printf '%s' "$value"
}

validate_secret() {
  local key="$1"
  local minimum_length="$2"
  local require_url_safe="$3"
  local value
  if [[ -v "$key" ]]; then
    value="${!key}"
  else
    value="$(dotenv_get "$key")"
  fi

  ((${#value} >= minimum_length)) ||
    die "$key must contain at least $minimum_length characters"
  case "${value,,}" in
    replace-with-* | changeme | password | secret | 123456)
      die "$key still contains a known placeholder value"
      ;;
  esac
  if is_true "$require_url_safe" && [[ ! "$value" =~ ^[A-Za-z0-9._~-]+$ ]]; then
    die "$key must be URL-safe because it is embedded in a connection URL"
  fi

  printf -v "$key" '%s' "$value"
  export "${key?}"
}

validate_configuration() {
  [[ -f "$ENV_FILE" ]] || die "missing environment file: $ENV_FILE"
  [[ -f "$COMPOSE_FILE" ]] || die "missing Compose file: $COMPOSE_FILE"
  chmod 600 "$ENV_FILE"

  if [[ -z "$SERVER_ADDRESS" ]]; then
    SERVER_ADDRESS="$(dotenv_get SERVER_ADDRESS)"
  fi
  SERVER_ADDRESS="${SERVER_ADDRESS%/}"
  case "$SERVER_ADDRESS" in
    http://* | https://*) ;;
    *) die "SERVER_ADDRESS must be an absolute HTTP(S) URL" ;;
  esac
  if [[ "$SERVER_ADDRESS" == *' '* || "$SERVER_ADDRESS" == *'"'* || "$SERVER_ADDRESS" == *"'"* ]]; then
    die "SERVER_ADDRESS contains unsupported characters"
  fi

  if [[ -z "$HOST_PORT" ]]; then
    HOST_PORT="$(dotenv_get HOST_PORT)"
  fi
  HOST_PORT="${HOST_PORT:-3000}"
  [[ "$HOST_PORT" =~ ^[0-9]+$ ]] || die "HOST_PORT must be numeric"

  if [[ -z "$VERIFY_EXTERNAL" ]]; then
    VERIFY_EXTERNAL="$(dotenv_get VERIFY_EXTERNAL)"
  fi
  VERIFY_EXTERNAL="${VERIFY_EXTERNAL:-true}"

  validate_secret POSTGRES_PASSWORD 16 true
  validate_secret REDIS_PASSWORD 16 true
  validate_secret SESSION_SECRET 32 false
  validate_secret CRYPTO_SECRET 32 false

  if [[ -z "$POSTGRES_IMAGE" ]]; then
    POSTGRES_IMAGE="$(dotenv_get POSTGRES_IMAGE)"
  fi
  POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15}"
}

require_clean_tracked_worktree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short >&2
    die "tracked Git changes must be committed or stashed before deployment"
  fi
}

update_repository() {
  is_true "$SKIP_GIT_UPDATE" && return

  CURRENT_STAGE="updating repository"
  local current_branch before after
  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "$BRANCH" ]] ||
    die "current branch is '$current_branch', expected '$BRANCH'"
  require_clean_tracked_worktree

  before="$(git rev-parse HEAD)"
  run git fetch "$REMOTE" "$BRANCH"
  run git pull --ff-only "$REMOTE" "$BRANCH"
  after="$(git rev-parse HEAD)"

  if [[ "$before" != "$after" && "${DEPLOY_REEXEC:-0}" != "1" ]]; then
    log "repository updated; restarting with the new deployment script"
    exec env DEPLOY_REEXEC=1 bash "$SCRIPT_PATH" "${ORIGINAL_ARGS[@]}"
  fi
}

check_host_resources() {
  CURRENT_STAGE="checking host resources"
  local available_kb available_gb memory_kb memory_mb
  available_kb="$(df -Pk "$REPO_ROOT" | awk 'NR == 2 {print $4}')"
  available_gb=$((available_kb / 1024 / 1024))
  ((available_gb >= 10)) || die "at least 10 GiB of free disk space is required"

  memory_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  memory_mb=$((memory_kb / 1024))
  if ((memory_mb < 2048)); then
    log "warning: less than 2 GiB RAM is available; Docker builds may fail"
  fi
  log "host resources: ${available_gb} GiB disk free, ${memory_mb} MiB RAM"
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

container_label() {
  local value
  value="$(docker inspect --format "{{index .Config.Labels \"$2\"}}" "$1" 2>/dev/null || true)"
  [[ "$value" == "<no value>" ]] && value=""
  printf '%s' "$value"
}

discover_existing_deployment() {
  CURRENT_STAGE="discovering existing deployment"
  local detected_project=""
  local detected_volume=""
  local detected_network=""
  local container

  for container in new-api postgres; do
    if container_exists "$container"; then
      detected_project="$(container_label "$container" com.docker.compose.project)"
      [[ -n "$detected_project" ]] && break
    fi
  done
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-${detected_project:-new-api}}"

  if container_exists postgres; then
    detected_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' postgres)"
  fi
  if [[ -z "$detected_volume" ]] && docker volume inspect new-api_pg_data >/dev/null 2>&1; then
    detected_volume="new-api_pg_data"
  fi
  POSTGRES_VOLUME_NAME="${POSTGRES_VOLUME_NAME:-${detected_volume:-new-api_pg_data}}"

  for container in new-api postgres; do
    if container_exists "$container"; then
      detected_network="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$container" | head -n 1)"
      [[ -n "$detected_network" ]] && break
    fi
  done
  NETWORK_NAME="${NETWORK_NAME:-${detected_network:-new-api_new-api-network}}"

  DEPLOY_TAG="$(git rev-parse --short=12 HEAD)"
  APP_IMAGE="${APP_IMAGE:-${APP_IMAGE_REPOSITORY:-kkcode-new-api}:$DEPLOY_TAG}"
  DEPLOY_ROOT="$REPO_ROOT"

  export COMPOSE_PROJECT_NAME POSTGRES_VOLUME_NAME NETWORK_NAME
  export DEPLOY_TAG APP_IMAGE DEPLOY_ROOT HOST_PORT POSTGRES_IMAGE

  log "Compose project: $COMPOSE_PROJECT_NAME"
  log "PostgreSQL volume: $POSTGRES_VOLUME_NAME"
  log "Docker network: $NETWORK_NAME"
  log "application image: $APP_IMAGE"
}

guard_legacy_sqlite() {
  volume_has_postgres_data && return

  local database_path
  for database_path in "$REPO_ROOT/one-api.db" "$REPO_ROOT/data/one-api.db"; do
    if [[ -s "$database_path" ]]; then
      die "legacy SQLite data found at $database_path; explicit SQLite-to-PostgreSQL import is required"
    fi
  done
}

volume_has_postgres_data() {
  docker volume inspect "$POSTGRES_VOLUME_NAME" >/dev/null 2>&1 || return 1
  docker run --rm --entrypoint sh \
    -v "$POSTGRES_VOLUME_NAME:/var/lib/postgresql/data:ro" \
    "$POSTGRES_IMAGE" -c 'test -s /var/lib/postgresql/data/PG_VERSION'
}

wait_for_postgres_container() {
  local container="$1"
  local user="$2"
  local database="$3"
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while ((SECONDS < deadline)); do
    if docker exec "$container" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  die "PostgreSQL container $container did not become ready"
}

prepare_backup_source() {
  BACKUP_SOURCE_CONTAINER=""
  if container_exists postgres; then
    if [[ "$(docker inspect --format '{{.State.Status}}' postgres)" != "running" ]]; then
      run docker start postgres
    fi
    wait_for_postgres_container postgres root new-api
    BACKUP_SOURCE_CONTAINER="postgres"
    return 0
  fi

  if ! volume_has_postgres_data; then
    return 0
  fi
  TEMP_BACKUP_CONTAINER="kkcode-postgres-backup-${DEPLOY_TAG}-$$"
  run docker run -d --rm \
    --name "$TEMP_BACKUP_CONTAINER" \
    --network none \
    -v "$POSTGRES_VOLUME_NAME:/var/lib/postgresql/data" \
    "$POSTGRES_IMAGE"
  wait_for_postgres_container "$TEMP_BACKUP_CONTAINER" root new-api
  BACKUP_SOURCE_CONTAINER="$TEMP_BACKUP_CONTAINER"
}

capture_core_counts() {
  local container="$1"
  local user="$2"
  local database="$3"
  local destination="$4"
  docker exec "$container" psql -U "$user" -d "$database" -Atqc \
    "select 'users=' || count(*) from users; select 'channels=' || count(*) from channels; select 'tokens=' || count(*) from tokens; select 'options=' || count(*) from options;" \
    >"$destination"
}

validate_backup_restore() {
  local dump_path="$1"

  CURRENT_STAGE="validating PostgreSQL backup restore"
  VALIDATION_CONTAINER="kkcode-postgres-validate-${DEPLOY_TAG}-$$"
  run docker run -d --rm \
    --name "$VALIDATION_CONTAINER" \
    --network none \
    -e POSTGRES_PASSWORD=backup-validation-only \
    "$POSTGRES_IMAGE"
  wait_for_postgres_container "$VALIDATION_CONTAINER" postgres postgres
  run docker exec "$VALIDATION_CONTAINER" createdb -U postgres restore_check
  docker exec -i "$VALIDATION_CONTAINER" pg_restore \
    -U postgres \
    -d restore_check \
    --no-owner \
    --no-privileges \
    --exit-on-error <"$dump_path"
  capture_core_counts \
    "$VALIDATION_CONTAINER" postgres restore_check \
    "$BACKUP_DIR/core-counts-restored.txt"

  if ! diff -u \
    "$BACKUP_DIR/core-counts-before.txt" \
    "$BACKUP_DIR/core-counts-restored.txt" \
    >"$BACKUP_DIR/core-counts-restore.diff"; then
    die "restored backup core table counts do not match the source database"
  fi

  run docker stop "$VALIDATION_CONTAINER"
  VALIDATION_CONTAINER=""
}

create_backup() {
  prepare_backup_source
  if [[ -z "$BACKUP_SOURCE_CONTAINER" ]]; then
    log "no existing PostgreSQL data; treating this as a new installation"
    return
  fi

  CURRENT_STAGE="backing up PostgreSQL"
  BACKUP_DIR="$REPO_ROOT/backups/$(date '+%Y%m%d-%H%M%S')"
  run mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  git rev-parse HEAD >"$BACKUP_DIR/git-commit.txt"
  docker inspect new-api postgres >"$BACKUP_DIR/containers.json" 2>/dev/null || true
  cp "$ENV_FILE" "$BACKUP_DIR/env.production"
  chmod 600 "$BACKUP_DIR/env.production"

  local database_path
  for database_path in "$REPO_ROOT/one-api.db" "$REPO_ROOT/data/one-api.db"; do
    if [[ -f "$database_path" ]]; then
      cp -a "$database_path" "$BACKUP_DIR/"
    fi
  done

  docker exec "$BACKUP_SOURCE_CONTAINER" pg_dump -U root -d new-api -Fc >"$BACKUP_DIR/postgres.dump.tmp"
  [[ -s "$BACKUP_DIR/postgres.dump.tmp" ]] || die "PostgreSQL backup is empty"
  mv "$BACKUP_DIR/postgres.dump.tmp" "$BACKUP_DIR/postgres.dump"
  docker exec -i "$BACKUP_SOURCE_CONTAINER" pg_restore --list <"$BACKUP_DIR/postgres.dump" >"$BACKUP_DIR/postgres.list"
  [[ -s "$BACKUP_DIR/postgres.list" ]] || die "PostgreSQL backup validation failed"

  capture_core_counts \
    "$BACKUP_SOURCE_CONTAINER" root new-api \
    "$BACKUP_DIR/core-counts-before.txt"

  if [[ -n "$TEMP_BACKUP_CONTAINER" ]]; then
    run docker stop "$TEMP_BACKUP_CONTAINER"
    TEMP_BACKUP_CONTAINER=""
    BACKUP_SOURCE_CONTAINER=""
  fi

  validate_backup_restore "$BACKUP_DIR/postgres.dump"
  log "fully restored and validated backup: $BACKUP_DIR/postgres.dump"
}

wait_for_service() {
  local service="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  local container_id=""
  local state=""
  local health=""

  while ((SECONDS < deadline)); do
    container_id="$(docker inspect --format '{{.Id}}' "$service" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$state" == "running" && ("$health" == "healthy" || "$health" == "none") ]]; then
        if [[ "$health" == "none" ]]; then
          die "$service is running without the required health check"
        fi
        log "$service is $state/$health"
        return 0
      fi
      if [[ "$state" == "exited" || "$state" == "dead" ]]; then
        compose logs --tail=120 "$service" >&2 || true
        die "$service stopped during startup"
      fi
    fi
    log "waiting for $service, current status: ${state:-missing}/${health:-unknown}"
    sleep 5
  done

  compose logs --tail=120 "$service" >&2 || true
  die "$service did not become healthy within ${HEALTH_TIMEOUT}s"
}

sync_server_address() {
  CURRENT_STAGE="synchronizing ServerAddress"
  local sql
  sql="$(cat <<'SQL'
INSERT INTO options (key, value)
VALUES ('ServerAddress', :'server_address')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SQL
)"

  printf '%s\n' "$sql" |
    docker exec -i -e "DEPLOY_SERVER_ADDRESS=$SERVER_ADDRESS" postgres sh -c \
      'exec psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-root}" -d "${POSTGRES_DB:-new-api}" --set=server_address="$DEPLOY_SERVER_ADDRESS"'
}

verify_status_url() {
  local url="$1"
  local expected_address="$2"
  local body compact

  body="$(curl -fsS --retry 3 --retry-delay 2 --max-time 20 "$url")"
  compact="$(printf '%s' "$body" | tr -d '[:space:]')"
  printf '%s' "$compact" | grep -Eq '"success":true' ||
    die "$url did not return success=true"
  if [[ -n "$expected_address" ]]; then
    printf '%s' "$compact" | grep -Fq "\"server_address\":\"$expected_address\"" ||
      die "$url did not report server_address=$expected_address"
  fi
  log "verified $url"
}

record_post_deploy_state() {
  [[ -n "$BACKUP_DIR" ]] || return
  docker exec postgres psql -U root -d new-api -Atqc \
    "select 'users=' || count(*) from users; select 'channels=' || count(*) from channels; select 'tokens=' || count(*) from tokens; select 'options=' || count(*) from options;" \
    >"$BACKUP_DIR/core-counts-after.txt"
  docker inspect new-api postgres redis >"$BACKUP_DIR/containers-after.json"
}

verify_database() {
  local result
  result="$(docker exec postgres psql -U root -d new-api -Atqc 'select 1')"
  [[ "$result" == "1" ]] || die "PostgreSQL verification query failed"
  log "verified PostgreSQL query path"
}

deploy() {
  create_backup

  CURRENT_STAGE="building application image"
  run compose build --pull new-api

  CURRENT_STAGE="starting PostgreSQL and Redis"
  run compose up -d postgres redis
  wait_for_service postgres
  wait_for_service redis

  CURRENT_STAGE="starting application"
  run compose up -d --no-deps new-api
  wait_for_service new-api

  sync_server_address
  run compose restart new-api
  wait_for_service new-api

  CURRENT_STAGE="verifying service"
  verify_database
  verify_status_url "http://127.0.0.1:${HOST_PORT}/api/status" "$SERVER_ADDRESS"
  if is_true "$VERIFY_EXTERNAL"; then
    verify_status_url "${SERVER_ADDRESS}/api/status" "$SERVER_ADDRESS"
  fi

  run docker tag "$APP_IMAGE" kkcode-new-api:local
  record_post_deploy_state
  compose ps

  log "deploy complete: $(git rev-parse --short HEAD) -> $SERVER_ADDRESS"
  if [[ -n "$BACKUP_DIR" ]]; then
    log "backup: $BACKUP_DIR"
  fi
}

main() {
  cd "$REPO_ROOT"
  parse_arguments "$@"
  acquire_deployment_lock
  if ! command -v docker >/dev/null 2>&1 && ((EUID != 0)); then
    die "Docker is missing; rerun with: sudo bash deploy/one-click.sh"
  fi
  configure_privilege
  install_base_dependencies
  install_docker
  detect_compose
  validate_configuration
  update_repository
  require_clean_tracked_worktree
  check_host_resources
  run mkdir -p "$REPO_ROOT/data" "$REPO_ROOT/logs" "$REPO_ROOT/backups"
  chmod 700 "$REPO_ROOT/backups"
  discover_existing_deployment
  guard_legacy_sqlite
  CURRENT_STAGE="validating Compose configuration"
  compose config >/dev/null
  if is_true "$CHECK_ONLY"; then
    log "preflight passed; no containers or data were changed"
    return
  fi
  deploy
}

main "$@"
