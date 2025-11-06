# AIRIS MCP Gateway - Task List

**Last Updated**: 2025-10-15
**Purpose**: OpenMCP Lazy Loading Pattern implementation to solve token explosion problem
**Maintained by**: Agiletec Inc.

---

## 📊 プロジェクト概要

### 目標
- **トークン削減率**: 75-90%達成
- **方式**: OpenMCP風のschema partitioning + lazy loading
- **インストール**: ワンコマンドで全エディタに対応

### アーキテクチャ
```
Claude Code/Cursor/Zed
    ↓
FastAPI Proxy (http://localhost:8001/mcp/sse)
    ├─ Schema Partitioning（トップレベルのみ送信）
    ├─ expandSchema ツール追加（必要時に詳細取得）
    └─ Proxy to Docker MCP Gateway
        ↓
Docker MCP Gateway (http://localhost:9090/api/v1/mcp/sse)
    └─ 25 MCP Servers
```

---

## ✅ 完了済み（Phase 1）

### 1. インストールスクリプト
- **ファイル**: `install.sh`
- **機能**:
  - Docker存在確認
  - Gateway起動
  - Healthcheck待機（最大60秒）
  - `~/.claude/mcp.json` シンボリックリンク作成
  - インストール検証
- **使用方法**: `./install.sh`
- **完了日**: 2025-10-14

### 2. Makefileターゲット
- **ファイル**: `Makefile`
- **ターゲット**:
  - `make install-claude`: Claude Code用インストール
  - `make uninstall-claude`: アンインストール
- **完了日**: 2025-10-14

### 3. Schema Partitioning実装
- **ファイル**: `apps/api/app/core/schema_partitioning.py`
- **クラス**: `SchemaPartitioner`
- **機能**:
  - `partition_schema()`: トップレベルのみに分割
  - `store_full_schema()`: フルスキーマをメモリキャッシュ
  - `expand_schema()`: 指定パスの詳細取得
  - `get_token_reduction_estimate()`: 削減率推定
- **完了日**: 2025-10-14

### 4. MCP Proxy実装
- **ファイル**: `apps/api/app/api/endpoints/mcp_proxy.py`
- **エンドポイント**:
  - `GET /mcp/sse`: SSEプロキシ + schema partitioning
  - `POST /mcp/`: JSON-RPC 2.0プロキシ
- **機能**:
  - `tools/list` レスポンスをインターセプト
  - Schema partitioning適用
  - `expandSchema` ツール追加
  - `expandSchema` ツールコールをローカル処理
- **完了日**: 2025-10-14

### 5. トークン削減テスト
- **ファイル**: `test_token_reduction.py`
- **機能**:
  - Gateway vs Proxy のトークン数比較
  - 削減率計算
  - Top 10ツールのトークン分析
  - `expandSchema` 存在確認
- **完了日**: 2025-10-14

### 6. ドキュメント更新
- **ファイル**: `README.md`, `PERFORMANCE_TEST.md`
- **内容**:
  - Quick Install手順追加
  - ワンコマンドインストール説明
  - アーキテクチャ図更新
- **完了日**: 2025-10-14

---

## 🚧 進行中（Phase 2）

### 7. 実動作テスト
- **Status**: ⏳ 未実施
- **タスク**:
  - [ ] `make up` で全サービス起動
  - [ ] `test_token_reduction.py` 実行
  - [ ] 削減率75-90%達成確認
  - [ ] `expandSchema` ツール動作確認
  - [ ] 実際のエディタ接続テスト

### 8. Docker Compose統合
- **Status**: ⏳ 要確認
- **確認事項**:
  - [ ] `docker-compose.yml` にAPI proxyサービス追加済み？
  - [ ] FastAPI proxy が `http://localhost:8001` で起動？
  - [ ] `mcp.json` がproxy経由でGatewayに接続？
  - [ ] Healthcheck設定済み？

### 9. エラーハンドリング強化
- **Status**: 📋 未着手
- **タスク**:
  - [ ] Gateway接続失敗時のリトライ
  - [ ] Schema partitioning失敗時のフォールバック
  - [ ] `expandSchema` ツールのエラーメッセージ改善
  - [ ] ログレベル調整

---

## 📋 未着手（Phase 3）

### 10. 複数エディタ対応拡張
- **Status**: 📋 計画中
- **対応エディタ**:
  - [x] Claude Code（`~/.claude/mcp.json`）
  - [ ] Cursor（`.cursor/mcp.json`）
  - [ ] Windsurf（`.windsurf/mcp.json`）
  - [ ] Zed（`.config/zed/mcp.json`）
- **タスク**:
  - [ ] `install.sh` に全エディタ検出ロジック追加
  - [ ] 各エディタへのシンボリックリンク作成
  - [ ] エディタ別テスト

### 11. パフォーマンス最適化
- **Status**: 📋 未着手
- **タスク**:
  - [ ] Schema cache永続化（Redis検討）
  - [ ] SSEストリーム最適化
  - [ ] 並列プロキシ処理
  - [ ] メモリ使用量モニタリング

### 12. ドキュメント完成
- **Status**: 📋 未着手
- **タスク**:
  - [ ] `ARCHITECTURE.md` 作成
  - [ ] OpenMCPパターン詳細説明
  - [ ] トラブルシューティングガイド
  - [ ] API Reference生成

---

## 🔮 将来（Phase 4）

### 13. SuperClaude Installer修正
- **リポジトリ**: `~/github/SuperClaude_Framework`
- **ファイル**: `setup/components/mcp.py`
- **修正内容**:
  - Healthcheck待機ロジック追加
  - リトライメカニズム
  - エラーハンドリング強化

### 14. 公開配布パッケージ
- **Homebrew Tap**: `brew install agiletec-inc/airis-mcp-gateway`
- **NPM Package**: `npx @agiletec-inc/airis-mcp-gateway install`
- **公式URL**: `curl -fsSL https://airis-mcp.dev/install.sh | bash`
- **GitHub Release自動化**

---

## 🎯 次のアクション（優先順位順）

### 即座に実施（今日）
1. **実動作テスト実行**
   ```bash
   make up
   python test_token_reduction.py
   ```
   - 削減率75-90%確認
   - `expandSchema` 動作確認

2. **Docker Compose設定確認**
   ```bash
   docker compose ps
   curl http://localhost:8001/mcp/sse
   ```
   - API proxyが起動しているか
   - エンドポイントが応答するか

3. **実際のエディタ接続テスト**
   ```bash
   ./install.sh
   # Claude Code再起動
   # /mcp コマンド実行
   ```
   - 25サーバー全て認識されるか
   - `expandSchema` ツールが表示されるか

### 今週中に実施
4. **エラーハンドリング追加**
   - リトライロジック
   - フォールバック処理
   - ログ改善

5. **複数エディタ対応**
   - Cursor, Windsurf, Zed対応
   - `install.sh` 拡張

6. **ドキュメント完成**
   - `ARCHITECTURE.md`
   - トラブルシューティング

---

## 📝 メモ・課題

### 技術的課題
1. **SSEストリームのバッファリング問題**
   - Nginx経由の場合、`X-Accel-Buffering: no` 必要
   - 現在は設定済み

2. **Schema cache永続化**
   - 現在はメモリのみ（FastAPI再起動で消える）
   - Redis導入検討

3. **複数クライアント対応**
   - 現在は1クライアントのみ想定
   - 複数エディタ同時接続のテスト必要

### ドキュメント課題
1. **OpenMCPパターンの詳細説明**
   - リサーチドキュメントはあるが、実装詳細ドキュメントがない
   - `ARCHITECTURE.md` で補完予定

2. **トラブルシューティング**
   - 接続失敗時の対処法
   - パフォーマンス問題の診断

---

## 🔗 関連ドキュメント

- [リサーチレポート](docs/research/mcp_installation_best_practices_20251018.md) - MCPインストール方法調査
- [README.md](../README.md) - プロジェクト概要
- [PERFORMANCE_TEST.md](../PERFORMANCE_TEST.md) - パフォーマンステスト手順
- [SECRETS.md](../SECRETS.md) - シークレット管理

---

## 📊 進捗サマリー

| Phase | タスク数 | 完了 | 進行中 | 未着手 | 完了率 |
|-------|---------|-----|-------|-------|--------|
| Phase 1: 基本実装 | 6 | 6 | 0 | 0 | 100% |
| Phase 2: テスト・改善 | 3 | 0 | 3 | 0 | 0% |
| Phase 3: 拡張機能 | 3 | 0 | 0 | 3 | 0% |
| Phase 4: 将来計画 | 2 | 0 | 0 | 2 | 0% |
| **合計** | **14** | **6** | **3** | **5** | **43%** |

**最終目標**: トークン削減率75-90%達成 + 全エディタ対応 + ワンコマンドインストール
**現状**: 基本実装完了、実動作テスト待ち
