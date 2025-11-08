# MCP Server Profiles

AIRIS MCP Gatewayで使用できるプロファイル定義です。

## 📦 利用可能なプロファイル

### 1. Recommended（推奨設定）

**対象ユーザー**: 長期プロジェクト、本格的な開発

**含まれるサーバー**:
- Built-in: time, fetch, git, memory, sequentialthinking
- Gateway: filesystem, context7, serena, mindbase

**特徴**:
- ✅ 短期 + 長期のハイブリッド記憶
- ✅ LLM暴走防止（mindbase）
- ✅ コード理解（serena）
- ✅ 最新ドキュメント（context7）

**リソース**: ~500MB メモリ使用

---

### 2. Minimal（最小構成）

**対象ユーザー**: リソース制約環境、短期タスク

**含まれるサーバー**:
- Built-in: time, fetch, git, memory, sequentialthinking
- Gateway: filesystem, context7

**特徴**:
- ✅ 軽量・高速
- ✅ トークン効率◎
- ✅ 必須機能のみ

**リソース**: ~50MB メモリ使用

**トレードオフ**:
- ❌ 長期記憶なし
- ❌ コード理解機能なし

---

### 3. Custom（カスタム構成）

**対象ユーザー**: 特定ニーズに合わせた構成

**ベース**: Recommended または Minimal

**追加サーバー（選択的有効化）**:
- `puppeteer` - E2Eテスト
- `sqlite` - ローカルDB操作
- `tavily` - Web検索
- `supabase` - Supabase開発
- `github` - GitHub操作

---

## 🚀 プロファイル切り替え

```bash
# 推奨設定に切り替え
make profile-recommended

# 最小構成に切り替え
make profile-minimal

# 現在のプロファイル確認
make profile-info
```

---

## 📝 プロファイル定義ファイル

- `recommended.json` - 推奨設定の定義
- `minimal.json` - 最小構成の定義
- `custom.json` - カスタム構成のテンプレート（ユーザーが作成）

---

## 🔧 カスタムプロファイルの作成

```bash
# テンプレートをコピー
cp profiles/recommended.json profiles/custom.json

# 編集
vim profiles/custom.json

# 適用
make profile-custom
```

---

## 💡 選び方ガイド

| 状況 | プロファイル | 理由 |
|------|------------|------|
| 長期プロジェクト開発 | Recommended | 記憶機能・学習機能が充実 |
| 短期タスク・実験 | Minimal | 軽量・高速 |
| リソース制約環境 | Minimal | メモリ使用量 ~50MB |
| LLM暴走が問題 | Recommended | mindbaseで失敗学習 |
| コード理解が必要 | Recommended | serenaでセマンティック検索 |

---

## 🧠 Memory vs MindBase（プロファイル選択の鍵）

| 機能 | Minimal | Recommended |
|------|---------|-------------|
| 短期記憶 | ✅ memory | ✅ memory |
| 長期記憶 | ❌ なし | ✅ mindbase |
| 失敗学習 | ❌ なし | ✅ mindbase |
| コード理解 | ❌ なし | ✅ serena |

**Recommendedを選ぶべき理由**:
- 過去の失敗を繰り返さない（error category記録）
- 最新の判断を追跡（decision category）
- 会話履歴の永続化 + セマンティック検索

**Minimalを選ぶべき理由**:
- リソース節約（メモリ ~50MB）
- 高速レスポンス
- シンプルな構成

---

## 📚 詳細ドキュメント

- [MCP Best Practices](../docs/guides/mcp-best-practices.md) - 設計思想と詳細解説
- [MindBase Documentation](https://github.com/kazukinakai/mindbase) - 長期記憶システム
