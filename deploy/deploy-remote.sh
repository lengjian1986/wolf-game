#!/usr/bin/env bash
# Root-owned forced command for the dedicated deployment key.
set -euo pipefail
umask 077
if [[ ! ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo 'Only deploy <commit-sha> is permitted.' >&2
  exit 1
fi
revision=${BASH_REMATCH[1]}
app_root=/home/ec2-user/wolf-game
mkdir -p "$app_root/releases"
exec 9>"$app_root/deploy.lock"
flock -w 600 9
release="$app_root/releases/$revision"
mkdir -p "$release"
archive=$(mktemp "$app_root/release.XXXXXX.tar.gz")
trap 'unlink "$archive"' EXIT
head -c 104857600 > "$archive"
python3 - "$archive" "$release" <<'PY'
import sys,tarfile,pathlib
with tarfile.open(sys.argv[1],'r:gz') as archive:
    for member in archive.getmembers():
        path=pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not(member.isfile() or member.isdir()):
            raise ValueError('Unsafe release archive')
        if member.name.startswith('frontend/.env') or '.sessions' in member.name:
            raise ValueError('Release archive contains credentials')
    archive.extractall(sys.argv[2])
PY
previous=''
if [[ -f "$app_root/current-version" ]]; then previous=$(cat "$app_root/current-version"); fi
compose="$release/deploy/compose.aws.yml"
export APP_VERSION="$revision"
docker build -f "$release/deploy/Dockerfile" -t "wolf-game:$revision" "$release"
if ! docker compose --env-file "$app_root/.env" -f "$compose" up -d --wait --wait-timeout 180; then
  if [[ $previous =~ ^[0-9a-f]{40}$ ]]; then
    export APP_VERSION="$previous"
    docker compose --env-file "$app_root/.env" -f "$app_root/releases/$previous/deploy/compose.aws.yml" up -d --no-deps --wait --wait-timeout 90 app
  fi
  echo 'Deployment health check failed.' >&2
  exit 1
fi
curl --fail --silent http://127.0.0.1:20223/api/health
if [[ -n $previous && $previous != "$revision" ]]; then printf '%s\n' "$previous" > "$app_root/previous-version"; fi
printf '%s\n' "$revision" > "$app_root/current-version"
echo " Deployed $revision"
