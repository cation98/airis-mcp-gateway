FROM ghcr.io/agiletec-inc/mindbase-mcp:latest

# Patch memory-fs.js: Bug 1 (listMemories DB fallback) + Bug 2 (deleteMemory separate try/catch)
COPY memory-fs.js /app/dist/storage/memory-fs.js
