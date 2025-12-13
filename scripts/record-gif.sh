#!/bin/bash
# Record terminal demo and convert to GIF
set -e
cd "$(dirname "$0")/.."

CAST_FILE="/tmp/airis-demo.cast"
GIF_FILE="./assets/demo.gif"

echo "Recording demo..."

# Record with asciinema (using script to simulate the demo)
asciinema rec "$CAST_FILE" --overwrite --command '
sleep 0.5
echo "$ docker compose up -d"
sleep 0.3
docker compose up -d 2>&1
sleep 0.8
echo ""
echo "$ docker compose logs --tail 15"
sleep 0.3
docker compose logs --tail 15 2>&1 | tail -12
sleep 1
echo ""
echo "$ claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse"
sleep 0.3
echo "Added sse server airis-mcp-gateway with url: http://localhost:9400/sse"
sleep 0.8
echo ""
echo "Done! 34+ tools ready."
sleep 1.5
'

echo "Converting to GIF..."
agg "$CAST_FILE" "$GIF_FILE" --cols 80 --rows 24 --font-size 14 --speed 1.2

echo "Created: $GIF_FILE"
ls -lh "$GIF_FILE"
