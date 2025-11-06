#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
if [[ -z "${ACTION}" ]]; then
  echo "Usage: $0 <add|remove>" >&2
  exit 1
fi

HOSTS_FILE=${HOSTS_FILE:-/etc/hosts}
BLOCK_BEGIN="# >>> AIRIS MCP Gateway >>>"
BLOCK_END="# <<< AIRIS MCP Gateway <<<"
HOST_LINE="127.0.0.1 gateway.localhost api.gateway.localhost ui.gateway.localhost"

add_block() {
  if grep -q "$BLOCK_BEGIN" "$HOSTS_FILE"; then
    echo "Hosts block already present in $HOSTS_FILE"
    return
  fi

  tmp=$(mktemp)
  cat "$HOSTS_FILE" > "$tmp"
  {
    echo "$BLOCK_BEGIN"
    echo "$HOST_LINE"
    echo "$BLOCK_END"
  } >> "$tmp"
  cat "$tmp" > "$HOSTS_FILE"
  rm -f "$tmp"
  echo "Added AIRIS MCP Gateway host entries to $HOSTS_FILE"
}

remove_block() {
  if ! grep -q "$BLOCK_BEGIN" "$HOSTS_FILE"; then
    echo "Hosts block not present, nothing to remove"
    return
  fi

  tmp=$(mktemp)
  awk -v start="$BLOCK_BEGIN" -v end="$BLOCK_END" '
    $0==start {skip=1}
    skip && $0==end {skip=0; next}
    !skip {print}
  ' "$HOSTS_FILE" > "$tmp"
  cat "$tmp" > "$HOSTS_FILE"
  rm -f "$tmp"
  echo "Removed AIRIS MCP Gateway host entries from $HOSTS_FILE"
}

case "$ACTION" in
  add) add_block ;;
  remove) remove_block ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
