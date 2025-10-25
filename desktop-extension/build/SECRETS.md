# Secrets Management

**Maintained by**: Agiletec Inc.

---

## Architecture

AIRIS MCP Gateway uses **PostgreSQL + Fernet encryption** for secret storage, not Docker secrets.

### Why PostgreSQL?

Settings UI (Web-based configuration interface) requires centralized secret storage that can be managed through a web interface. PostgreSQL with encryption provides:

- **Centralized Management**: All secrets in one database
- **Web UI Integration**: Settings UI can CRUD secrets safely
- **Encryption at Rest**: Fernet (AES-128) encryption via cryptography library
- **Access Control**: Database-level permissions
- **Audit Trail**: Built-in logging capabilities

---

## Setup

### 1. Set Master Encryption Key

The encryption master key is used to encrypt/decrypt all secrets in PostgreSQL.

**Generate a new key**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Add to environment**:
```bash
# .env file (DO NOT COMMIT)
ENCRYPTION_MASTER_KEY=your_generated_key_here

# Or set in docker-compose.yml
environment:
  - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
```

⚠️ **CRITICAL**: Never commit the master key to Git. Store it in:
- Local `.env` file (`.gitignore`d)
- Environment variables
- Secure secret managers (AWS Secrets Manager, etc.)

### 2. Database Migration

Secrets are stored in PostgreSQL with encrypted values:

```bash
# Run database migrations to create secrets table
make db-migrate
```

### 3. Add Secrets via Settings UI

**Web UI** (Recommended):
```
http://localhost:5173
```

Navigate to "Secrets" tab and add:
- Stripe API Key
- Twilio credentials
- Figma tokens
- Custom secrets

**API** (Advanced):
```bash
curl -X POST http://localhost:8001/api/v1/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "key": "STRIPE_API_KEY",
    "value": "sk_live_...",
    "description": "Stripe production API key"
  }'
```

---

## How It Works

```
┌─────────────────┐
│  Settings UI    │  ← User adds secrets via web interface
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   FastAPI       │  ← Receives plaintext secret
│   (encryption)  │  → Encrypts with Fernet (master key)
└────────┬────────┘
         │ Encrypted bytes
         ▼
┌─────────────────┐
│  PostgreSQL     │  ← Stores encrypted value
│  (secrets table)│
└─────────────────┘

On retrieval:
PostgreSQL → FastAPI decrypts → MCP Servers (plaintext in memory)
```

### Encryption Details

**Implementation**: `apps/api/app/core/encryption.py`

```python
class EncryptionManager:
    def encrypt(plaintext: str) -> bytes:
        # PBKDF2HMAC (SHA-256, 100k iterations)
        # Fernet (AES-128 CBC + HMAC-SHA256)

    def decrypt(encrypted: bytes) -> str:
        # Reverse process
```

**Security Properties**:
- **Algorithm**: Fernet (symmetric encryption)
  - AES-128 in CBC mode
  - HMAC-SHA256 for authentication
- **Key Derivation**: PBKDF2HMAC with SHA-256
  - 100,000 iterations (防ブルートフォース)
  - Fixed salt: `airis-mcp-gateway-salt`
- **Encoding**: Base64 URL-safe encoding

---

## Security Benefits

### 1. **Encrypted at Rest**
- All secrets encrypted in PostgreSQL
- Master key never stored in database
- Encrypted blobs unreadable without master key

### 2. **No Git Exposure**
- Secrets never in plaintext files
- `.env` files `.gitignore`d
- Only encrypted data in repository (safe)

### 3. **Runtime Decryption Only**
- Secrets decrypted on-demand in memory
- Never written to disk in plaintext
- Process isolation prevents leaks

### 4. **Centralized Management**
- Single source of truth (PostgreSQL)
- Settings UI provides safe CRUD interface
- No scattered `.env` files across projects

### 5. **Audit Trail Ready**
- PostgreSQL logs all access
- Can add `created_at`, `updated_at`, `accessed_at` columns
- Track secret usage patterns

---

## Migration from Docker Secrets (Legacy)

If you previously used Docker MCP secrets:

```bash
# 1. Extract secrets from Docker
docker mcp secret ls

# 2. For each secret, add to Settings UI
#    (or use API endpoint shown above)

# 3. Remove Docker secrets (optional)
docker mcp secret rm STRIPE_API_KEY
```

---

## Environment Variables

Required:
```bash
ENCRYPTION_MASTER_KEY=<generated-key>  # Fernet encryption key
```

Optional:
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/mcp_gateway
API_DEBUG=true  # Enable debug logging
```

---

## Troubleshooting

### "No encryption key found"
```bash
# Generate and set ENCRYPTION_MASTER_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
export ENCRYPTION_MASTER_KEY="<generated-key>"
```

### "Invalid token" error when decrypting
- Master key changed or incorrect
- Database migration not run
- Corrupted encrypted value

**Solution**: Regenerate secrets with correct master key

### Settings UI can't save secrets
- Check API container logs: `make api-logs`
- Verify database connection: `make db-shell`
- Ensure migrations ran: `make db-migrate`

---

## Best Practices

1. **Rotate Master Key Regularly**
   - Generate new key
   - Re-encrypt all secrets with new key
   - Update environment variable

2. **Backup Encrypted Database**
   ```bash
   docker compose exec postgres pg_dump -U postgres mcp_gateway > backup.sql
   ```
   (Encrypted values are safe to backup)

3. **Use Different Keys per Environment**
   - Development: `ENCRYPTION_MASTER_KEY_DEV`
   - Production: `ENCRYPTION_MASTER_KEY_PROD`
   - Never reuse keys across environments

4. **Monitor Secret Access**
   - Add audit logging to secrets table
   - Alert on unusual access patterns
   - Regular security reviews

---

## Reference

- **Encryption**: `apps/api/app/core/encryption.py`
- **Schema**: Database migration files in `apps/api/alembic/versions/`
- **API**: `apps/api/app/api/endpoints/secrets.py` (if implemented)
- **UI**: `apps/settings/` (React + Vite)

**Security Standard**: NIST SP 800-132 (Password-Based Key Derivation)
