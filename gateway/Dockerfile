# AIRIS MCP Gateway - Unified MCP Server Routing Layer
# Based on docker/mcp-gateway with AIRIS branding

FROM docker/mcp-gateway:latest

LABEL maintainer="AIRIS MCP Gateway Team"
LABEL description="AIRIS MCP Gateway - Centralized MCP Server routing with 11+ integrated servers"
LABEL version="1.3.0"

# AIRIS-specific environment variables
ENV AIRIS_VERSION="1.3.0"
ENV AIRIS_MCP_GATEWAY="true"

# Copy secret injection script
COPY inject-secrets.sh /usr/local/bin/inject-secrets.sh
RUN chmod +x /usr/local/bin/inject-secrets.sh

# Health check for AIRIS Gateway
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${GATEWAY_LISTEN_PORT:-9090}/" || exit 1

# Use secret injection script as entrypoint
ENTRYPOINT ["/usr/local/bin/inject-secrets.sh"]
CMD ["/docker-mcp", "gateway", "run", "--transport=sse", "--port=9090"]
