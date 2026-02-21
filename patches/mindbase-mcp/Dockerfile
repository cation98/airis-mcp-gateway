FROM ghcr.io/agiletec-inc/mindbase-mcp:latest

# Patch memory-fs.js: Bug 1 (listMemories DB fallback) + Bug 2 (deleteMemory separate try/catch) + Bug 4 (search threshold 0.7→0.5)
COPY memory-fs.js /app/dist/storage/memory-fs.js

# Patch conversation.js: Bug 4 (conversation_search threshold 0.7→0.5 for nomic-embed-text compatibility)
COPY conversation.js /app/dist/tools/conversation.js
