# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT create a public GitHub issue** for security vulnerabilities
2. Send an email to: **security@agiletec.co.jp**
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

| Response Stage | Timeline |
|----------------|----------|
| Initial acknowledgment | Within 48 hours |
| Status update | Within 7 days |
| Fix release (critical) | Within 14 days |
| Fix release (high) | Within 30 days |
| Fix release (medium/low) | Within 90 days |

### Scope

The following are in scope for security reports:

- AIRIS MCP Gateway API (FastAPI)
- Authentication/authorization bypass
- Injection vulnerabilities (SQL, command, etc.)
- Information disclosure
- Denial of service
- Container escape
- Credential exposure

### Out of Scope

- Vulnerabilities in upstream dependencies (report to the respective maintainers)
- Issues in development/test configurations
- Social engineering attacks
- Physical attacks

## Security Measures

### Current Implementation

- **Authentication**: Optional API key authentication (`AIRIS_API_KEY`)
- **Rate Limiting**: Per-IP (100/min) and Per-API-Key (1000/min) limits
- **CORS**: Configurable allowed origins (`ALLOWED_ORIGINS`)
- **Non-root Container**: Runs as `appuser` (UID 1000)
- **Resource Limits**: Memory (2GB) and CPU (2 cores) limits
- **Request Tracing**: X-Request-ID for audit logging

### Recommended Production Configuration

```bash
# Required for production
ALLOWED_ORIGINS=https://your-app.com,https://admin.your-app.com
AIRIS_API_KEY=<strong-random-key>

# Optional tuning
RATE_LIMIT_PER_IP=50
RATE_LIMIT_PER_API_KEY=500
LOG_FORMAT=json
```

### Security Best Practices

1. **Always set `ALLOWED_ORIGINS`** in production (do not use `*`)
2. **Enable API key authentication** for public-facing deployments
3. **Use HTTPS** via reverse proxy (nginx, Traefik, etc.)
4. **Monitor `/metrics`** for anomalies
5. **Review logs** with request_id for incident investigation
6. **Keep dependencies updated** (`uv pip list --outdated`)

## Acknowledgments

We appreciate security researchers who help keep AIRIS MCP Gateway secure. Contributors who report valid vulnerabilities will be acknowledged here (with permission).
