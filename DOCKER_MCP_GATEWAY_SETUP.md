# Docker MCP Gateway セットアップ完了報告

## ✅ 成功した構成

### 使用技術
- **Base Image**: `docker/mcp-gateway:latest`
- **CLI**: `/docker-mcp gateway run` (絶対パス必須)
- **Transport**: SSE (Server-Sent Events)
- **Port**: 9390
- **互換性**: OrbStack ✅ / Docker Desktop ✅

### アーキテクチャ

```
IDE/Claude Code
    ↓ (MCP Protocol)
FastAPI Proxy (localhost:9400)
    ↓ (Schema Partitioning)
Docker MCP Gateway (localhost:9390)
    ↓ (Container Orchestration)
MCP Servers (filesystem, context7, mindbase, serena, puppeteer)
```

## 📝 重要な修正ポイント

### 1. OpenMCP vs Docker MCP Gateway の誤解を解消

**誤**: `openmcp` = MCP Gateway
**正**: `docker/mcp-gateway` = 公式 MCP Gateway

- **OpenMCP**: OpenAPI仕様をMCPサーバーに変換するツール（npm package）
- **Docker MCP Gateway**: 複数のMCPサーバーを統合管理するゲートウェイ（Docker image）

### 2. CLI コマンドパスの修正

```dockerfile
# ❌ 誤り（パスが通っていない）
CMD ["docker-mcp", "gateway", "run", "--transport=sse", "--port=9390"]

# ✅ 正解（絶対パス）
CMD ["/docker-mcp", "gateway", "run", "--transport=sse", "--port=9390"]
```

**理由**: Docker MCP Gateway イメージ内では `/docker-mcp` が実行ファイルのフルパス

### 3. `--servers` フラグの削除

```yaml
# ❌ 旧構成（ハードコード）
command:
  - /docker-mcp
  - gateway
  - run
  - --servers=filesystem
  - --servers=context7
  - --servers=serena

# ✅ 新構成（動的設定）
command:
  - /docker-mcp
  - gateway
  - run
  - --transport=sse
  - --port=9390
  - --config=/etc/docker-mcp/config.json
```

**理由**:
- サーバー一覧は `mcp-config.json` から動的生成
- データベースがSSO (Single Source of Truth)
- `gateway/inject-secrets.sh` が起動時に設定を生成

## 🚀 起動手順

### 標準起動（ホストポート公開）

```bash
docker compose up -d
```

### サービス確認

```bash
# コンテナ状態確認
docker compose ps

# 期待される出力:
# - postgres: healthy
# - api: healthy (0.0.0.0:9400->9900)
# - mcp-gateway: healthy (0.0.0.0:9390->9390)
# - settings-ui: healthy (0.0.0.0:5273->5273)
```

### 動作確認

```bash
# API ヘルスチェック
curl http://localhost:9400/health
# 期待: {"status":"healthy"}

# Settings UI
curl -I http://localhost:5273/
# 期待: HTTP/1.1 200 OK

# Gateway ログ確認
docker compose logs mcp-gateway | grep "Start sse server"
# 期待: > Start sse server on port 9390
```

## 🔧 技術詳細

### 動的設定生成フロー

1. **起動時**: `gateway/inject-secrets.sh` が実行
2. **API接続**: `http://api:9900` から設定取得
3. **シークレット注入**: Fernet暗号化されたAPI キーをenv varに展開
4. **サーバー一覧取得**: PostgreSQL から `enabled=true` のサーバーのみ取得
5. **config.json生成**: `/etc/docker-mcp/config.json` に書き込み
6. **カタログ登録**: `docker-mcp server enable` でカタログサーバー有効化
7. **Gateway起動**: `/docker-mcp gateway run` 実行

### 内部ツール

Gateway起動時に自動追加されるツール：

- `mcp-find`: カタログからサーバーを検索
- `mcp-add`: サーバーをレジストリに追加
- `mcp-remove`: サーバーをレジストリから削除
- `mcp-config-set`: サーバー設定値を変更
- `code-mode`: 他のMCPを直接呼び出すコードを書く
- `mcp-exec`: 現在のセッションに存在するツールを実行
- `mcp-discover`: 動的サーバー管理について学ぶプロンプト

### サーバー分類

**カタログサーバー** (Docker MCP Catalog 提供):
- filesystem, context7, puppeteer, playwright, brave, chrome-devtools, sqlite
- `docker-mcp server enable <name>` で有効化
- 設定ファイルには `{"enabled": true}` のみ記載

**カスタムサーバー** (独自実装):
- mindbase, serena
- 設定ファイルに完全な `command`, `args`, `env` を記載
- Docker-in-Docker または uvx で実行

## 📊 テスト結果

### ✅ 成功項目

| 項目 | 状態 | 詳細 |
|------|------|------|
| Gateway 起動 | ✅ | SSE server on port 9390 |
| シークレット注入 | ✅ | 5 secrets loaded (TAVILY, STRIPE, FIGMA等) |
| 動的設定生成 | ✅ | 5 servers enabled (context7, filesystem, mindbase, puppeteer, serena) |
| カタログ統合 | ✅ | Catalog servers registered |
| 内部ツール追加 | ✅ | 7 tools added (mcp-find, mcp-add, etc.) |
| API ヘルスチェック | ✅ | `{"status":"healthy"}` |
| Settings UI | ✅ | http://localhost:5273/ 表示 |
| OrbStack互換性 | ✅ | `/var/run/docker.sock` マウント動作 |

## 📚 関連ドキュメント

- **公式**: [Docker MCP Gateway Docs](https://docs.docker.com/ai/mcp-gateway/)
- **GitHub**: [docker/mcp-gateway](https://github.com/docker/mcp-gateway)

## 📌 コミット履歴

```bash
# 主要な修正コミット
811738b1 - fix: use absolute path /docker-mcp for Docker MCP Gateway binary
599f5b92 - fix: correct docker-mcp CLI command paths and remove hardcoded servers
0e3abd98 - docs: enhance CLAUDE.md with Dynamic profile and troubleshooting
```

---

**作成日**: 2025-01-13
**担当**: Claude Code (Sonnet 4.5)
**ステータス**: ✅ Gateway起動成功、基本動作確認完了
