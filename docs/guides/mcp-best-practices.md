# MCP最適構成ベストプラクティス（2025年10月版）

**対象**: Claude Code + Supabase + AIRIS MCP Gateway
**更新日**: 2025-10-16
**ステータス**: 現在の構成評価 + 推奨事項

---

## 📊 現在の構成評価

### ✅ Built-in Servers（`--servers`フラグ有効化済み）

| Server | 状態 | 評価 | 理由 |
|--------|------|------|------|
| **time** | ✅ 有効 | 🟢 **必須** | 正確なタイムスタンプ取得、「2004年問題」解決に必須 |
| **fetch** | ✅ 有効 | 🟢 **推奨** | URL内容取得、Tavilyと競合しない単独使用 |
| **sequentialthinking** | ✅ 有効 | 🟢 **必須** | 複雑な分析・多段階推論、SuperClaude Framework推奨 |
| **git** | ✅ 有効 | 🟢 **推奨** | Git操作、バージョン管理 |
| **memory** | ✅ 有効 | 🟢 **推奨** | 知識グラフ、長期記憶 |

### ✅ Gateway NPX Servers（認証不要、常時有効）

| Server | 状態 | 評価 | 理由 |
|--------|------|------|------|
| **filesystem** | ✅ 有効 | 🟢 **必須** | `/workspace/github`アクセス |
| **context7** | ✅ 有効 | 🟢 **必須** | 最新ドキュメント（15,000+ライブラリ対応）|
| **serena** | ✅ 有効 | 🟢 **推奨** | コード理解・セマンティック検索 |
| **puppeteer** | ✅ 有効 | 🟡 **選択** | ブラウザ自動化（E2Eテスト時のみ） |
| **sqlite** | ✅ 有効 | 🟡 **選択** | ローカルDB（使用時のみ） |
| **mindbase** | ✅ 有効 | 🟢 **推奨** | 知識グラフ、セッション記憶 |

### ⏸️ Disabled Servers（認証必要、UI経由有効化）

| Server | 状態 | 評価 | 推奨アクション |
|--------|------|------|--------------|
| **tavily** | ⏸️ 無効 | 🟡 **選択** | Web検索必要時のみ有効化（fetchと競合注意） |
| **supabase** | ⏸️ 無効 | 🟢 **推奨** | DB連携必要時に有効化 |
| **github** | ⏸️ 無効 | 🟡 **選択** | GitHub操作必要時のみ |
| **brave-search** | ⏸️ 無効 | 🔴 **不要** | Tavily/Fetch併用なら不要 |

---

## 🎯 総合評価

### ✅ 現在の構成: **ほぼ理想的**

**理由**:
1. ✅ **Sequential/Time/Fetch** すべて有効化済み
2. ✅ **Fetch単独使用**（Tavilyは無効）= 競合なし、トークン効率◎
3. ✅ **Context7 + Serena** = 最新ドキュメント + コード理解の黄金コンビ
4. ✅ **認証系MCPは無効化** = セキュリティ◎、トークン節約◎

### ⚠️ 注意点

| 問題 | 現状 | 対策 |
|------|------|------|
| **Time未使用問題** | Claudeが`get_current_time`を使わず「2004年」等で調べる | ワークフロー強制実行（後述） |
| **Tavily/Fetch競合リスク** | 現在は無効化で回避 | Tavily有効化時は`tavily-extract`とFetchの併用禁止 |
| **Puppeteer常時有効** | トークン軽微に圧迫 | E2Eテスト時のみ有効化推奨 |

---

## 🚨 Time強制使用ワークフロー（「2004年問題」解決）

### 問題

> 「お前（Claude）は`time`入れてても使わないし、未だに2004年とかで調べたりする」

### 根本原因

- Claudeは知識カットオフ（2025年1月）をベースに推論
- `get_current_time`ツールの存在を認識しても自発的に使わないことがある
- 結果：古いタイムスタンプで分析してしまう

### 解決策：ワークフロー強制実行

```yaml
# ~/.claude/CLAUDE.md または RULES.md に追加

## Temporal Awareness
**Priority**: 🔴 **Triggers**: 日付/時刻参照、バージョン確認、期限計算、"latest"キーワード

- **必ず現在時刻を確認**: 日付・時刻が関係するタスク開始時、まず`get_current_time`実行
- **知識カットオフに依存禁止**: 2025年1月や知識カットオフ日付を前提にしない
- **明示的時刻参照**: 常に時刻情報の出典を明記
- **バージョンコンテキスト**: "latest"議論時は必ず現在日付と照合

✅ **正しい手順**:
1. タスク開始 → `get_current_time(timezone="Asia/Tokyo")` 実行
2. 結果確認：「現在時刻: 2025-10-16 22:45:00 JST」
3. この時刻をベースに分析・判断

❌ **禁止パターン**:
- 「2025年1月なので...」（知識カットオフ前提）
- 「2004年のデータでは...」（古いタイムスタンプ）
- 時刻確認なしで期限計算

**検出**: 日付/時刻参照時に`get_current_time`呼び出し履歴がない場合エラー
```

### ワークフロー統合例

```yaml
# MODE_Task_Management.md 等に追加

### Session Start（必須ステップ）
1. ✅ `get_current_time(timezone="UTC")` 実行
2. ✅ セッションコンテキストに現在時刻を記録
3. ✅ 以降の分析は必ずこの時刻をベースに実行

### 時刻依存タスク（必須ステップ）
- タスク開始前：`get_current_time` 実行確認
- タスク実行中：古いタイムスタンプを参照しない
- タスク完了後：時刻ベースの検証
```

### 実装効果

| Before | After |
|--------|-------|
| ❌ 「2004年のデータでは...」 | ✅ 「現在時刻（2025-10-16 22:45 JST）では...」 |
| ❌ 知識カットオフベース推論 | ✅ リアルタイム時刻ベース推論 |
| ❌ 期限計算ミス | ✅ 正確な期限計算 |

**トレードオフ**:
- 🟡 ワンステップ増加（`get_current_time`呼び出し）
- 🟢 時刻依存エラーが**完全に**消失
- 🟢 信頼性向上 > 効率微減

---

## 📚 ベストプラクティス詳細解説

### 1. Web検索・情報取得系（重複禁止）

#### ✅ 推奨構成A: **Fetch単独**（現在の構成）

```json
{
  "mcpServers": {
    "fetch": {
      "enabled": true  // Built-in
    },
    "tavily": {
      "enabled": false  // 無効化
    }
  }
}
```

**メリット**:
- トークン効率◎（Fetch単独、軽量）
- Brave Search等と競合なし
- セキュリティ◎（外部API不要）

**デメリット**:
- Web検索機能なし（URLを指定する必要がある）

---

#### ✅ 推奨構成B: **Tavily完結**

```json
{
  "mcpServers": {
    "tavily": {
      "enabled": true,
      "tools": ["tavily-search", "tavily-extract"]
    },
    "fetch": {
      "enabled": false  // 無効化
    }
  }
}
```

**メリット**:
- Web検索 + 内容抽出が1サーバーで完結
- 最新情報取得◎
- 無料プランあり

**デメリット**:
- API key必要
- トークン消費やや増加

---

#### ❌ 禁止構成: **Tavily + Fetch併用**

```json
// ❌ これは禁止
{
  "tavily": { "enabled": true },  // tavily-extract提供
  "fetch": { "enabled": true }    // 同じくURL内容取得
}
```

**問題**:
- `tavily-extract`と`fetch`が機能重複
- Claudeがどちらを使うか迷う
- プロンプトサイズ無駄に増加
- エラー率上昇

**対策**: どちらか一方のみ有効化

---

### 2. Sequential Thinking（複雑な分析必須）

#### なぜ必須か

```yaml
Use Cases:
  - 複雑なデバッグ（3+コンポーネント）
  - システム設計（多段階推論）
  - セキュリティ評価（仮説検証）
  - パフォーマンス分析（ボトルネック特定）

SuperClaude Framework位置づけ:
  - MCP_Sequential.md で**重要ツール**として明記
  - --think, --think-hard, --ultrathink フラグ対応
  - 推論精度向上、構造化思考実現
```

#### ベストプラクティス

```yaml
有効化条件:
  - 常時有効（Built-in推奨）
  - 複雑なタスクでは自動起動
  - トークンコストは許容範囲

無効化条件:
  - 簡単な質問のみの場合
  - トークン制約が極端に厳しい場合
```

---

### 3. Context7（最新ドキュメント必須）

#### 機能

- 15,000+ライブラリの最新公式ドキュメント
- API変更、使用法を自動取得
- 古い知識に基づく誤った提案を防止

#### ベストプラクティス

```yaml
トークン節約:
  - 巨大ドキュメント全体を注入しない
  - 必要なAPIセクションのみ抽出
  - "use context7 to find X method in Y library"

セキュリティ:
  - 公式ホスティング版は無料（レート制限あり）
  - 追加料金不要、安全に使用可能
```

---

### 4. Memory vs MindBase（記憶システムの責務分離）

#### 設計思想

**memory（Built-in）** と **mindbase（Gateway Docker）** は**補完関係**にあり、責務が明確に分離されています。

| 項目 | **memory**（Built-in） | **mindbase**（Gateway Docker） |
|------|----------------------|------------------------------|
| **データ構造** | エンティティ + 関係性（知識グラフ） | 会話 + セッション + カテゴリ分類 |
| **時系列管理** | ❌ 時系列概念なし | ✅ sessions階層 + 時刻更新 |
| **短期記憶** | ✅ セッション内コンテキスト | ✅ 直近セッションの会話（`session_id`） |
| **長期記憶** | ⚠️ セッション間永続性（制限あり） | ✅ 全セッション横断 + pgvector検索 |
| **情報更新** | ❌ 更新メカニズムなし | ✅ `category`（decision, progress）で最新状態追跡 |
| **失敗学習** | ❌ エラー追跡機能なし | ✅ `warning`, `error`カテゴリで失敗履歴記録 |
| **LLM暴走防止** | ❌ 防止機能なし | ✅ 同じミスを繰り返さない仕組み |

#### mindbaseの革新的な設計

**1. 時系列 + セマンティック検索のハイブリッド**
```sql
-- 短期記憶（直近セッション）
SELECT * FROM conversations
WHERE session_id = current_session_id
ORDER BY created_at DESC LIMIT 10;

-- 長期記憶（セマンティック検索 + 時系列減衰）
SELECT * FROM conversations
WHERE embedding <=> query_vector < 0.8
ORDER BY created_at DESC, similarity ASC;
```

**2. 責務ベースの分類（category）**
- `task` - タスク実行記録
- `decision` - 意思決定履歴（**最新の判断を追跡**）
- `progress` - 進捗更新（**状態遷移を記録**）
- `warning` - 警告発生（**問題の予兆**）
- `error` - エラー発生（**失敗から学習**）

**3. LLM暴走防止の実用的アプローチ**
```python
# 同じミスを繰り返さないチェック
recent_errors = await crud.search_conversations(
    category="error",
    session_id=current_session,
    limit=5
)

if similar_error_found(recent_errors, current_error):
    # 過去の解決策を提示
    past_solution = get_solution_from_history(recent_errors)
    return f"⚠️ 過去に同じエラー発生済み。解決策: {past_solution}"
```

#### 使い分けガイド

```yaml
memory（Built-in）を使う:
  - セッション内の即座のコンテキスト保持
  - エンティティ間の関係性管理
  - "さっき言った○○について" → memory

mindbase（Gateway Docker）を使う:
  - 会話履歴の永続化 + セマンティック検索
  - 失敗から学習する仕組み
  - 進捗追跡と最新状態の把握
  - "昨日議論した設計について" → mindbase
  - "過去に同じエラー出た？" → mindbase
  - "最新の判断は何？" → mindbase (category=decision)
```

#### 統合戦略（SuperClaude PM Agent）

```yaml
Session Start:
  1. memory: create_entities([current_context])  # 短期記憶
  2. mindbase: search_conversations(session_id)  # 長期記憶復元

During Work:
  1. memory: add_observations()  # 即座のコンテキスト
  2. mindbase: store(category="progress")  # 進捗記録

On Error:
  1. mindbase: search(category="error", query=error_msg)  # 過去の失敗検索
  2. mindbase: store(category="error", solution)  # 解決策記録

Session End:
  1. mindbase: store(category="decision", final_state)  # 最新状態保存
  2. memory: (揮発)  # セッション終了で消える
```

#### ベストプラクティス

```yaml
有効化推奨:
  - memory: 常時有効（Built-in、軽量）
  - mindbase: 長期プロジェクト、学習が必要な場合に有効

リソース管理:
  - mindbase: PostgreSQL + Ollama（qwen3-embedding:8b）
  - 合計 ~500MB メモリ使用（Docker）
  - 使わない場合は無効化推奨

セキュリティ:
  - 会話データは ~/Library/Application Support/mindbase/
  - Claude Codeが直接読み込まない（ノイズ回避）
  - API経由でのみアクセス（http://localhost:18002）
```

---

### 5. Supabase MCP（DB連携、選択的有効化）

#### 有効化タイミング

```yaml
有効化:
  - Supabase開発プロジェクト
  - データベース操作が必要な場合
  - CRUD操作、関数設定、ポリシー管理

無効化:
  - Supabase不使用プロジェクト
  - トークン節約優先時
  - セキュリティリスク回避
```

#### セキュリティ注意事項

```yaml
⚠️ 重要:
  - ClaudeにDB直接アクセス権を与える
  - 使わない時は無効化
  - 認可設定を慎重に管理
  - 本番環境では特に注意

推奨設定:
  - SUPABASE_ANON_KEY（制限付き）使用
  - SERVICE_ROLE_KEY（フルアクセス）は避ける
  - Row Level Security（RLS）必須
```

---

### 6. Desktop Commander（ローカル環境制御、慎重に）

#### 機能

- ターミナルコマンド実行（出力ストリーム表示）
- ファイル・ディレクトリ読み書き
- プロセス管理

#### セキュリティベストプラクティス

```yaml
✅ 安全な使用:
  - 信頼できるプロジェクトのみ
  - オフライン環境
  - ユーザー承認プロンプト確認必須
  - 不審なコマンド実行時は「拒否」

❌ 危険な使用:
  - 公開プロンプト実行
  - 不審なコード実行
  - 破壊的コマンドの無確認実行

推奨運用:
  - 必要時のみ有効化
  - 実行前に必ず内容確認
  - 運用ガイドライン設定
```

---

## 🛡️ セキュリティ・トークン最適化

### 1. 必要最小限のツール構成

```yaml
原則:
  - 使う見込みのないツールは登録しない/無効化
  - 一度に有効化するMCP数を絞る
  - プロンプト圧迫を避ける

効果:
  - トークン消費削減
  - モデル判断負荷軽減
  - エラー率低下
```

### 2. MCPツール出力の絞り込み

```yaml
Fetch:
  - HTML → Markdown変換（不要部分除去）
  - ナビゲーション・広告削除
  - トークン大幅削減

検索系:
  - 結果を全件表示しない
  - 関連部分のみ抽出
  - 上位N件に限定

Context7:
  - 巨大ドキュメント全体を注入しない
  - 必要なAPIセクションのみ
```

### 3. 認証情報の安全管理

```yaml
ゼロトラスト設計:
  - APIキー・Tokenは環境変数経由
  - Claudeに直接晒さない
  - ゲートウェイ経由で安全に渡す

設定例:
  "env": {
    "API_KEY": "${API_KEY}"  // モデルは値を認識しない
  }

企業向け:
  - AIRIS MCP Gateway: RBAC、アクセスログ、アラート
  - 詳細なアクセス制御
  - 異常検知・通知
```

### 4. オンデマンド呼び出し活用

```yaml
AIRIS MCP Gatewayの利点:
  - ツール説明を事前にプロンプトに載せない
  - モデルがツールを使う時点で初めて提供
  - トークン節約◎
  - プロンプトインジェクション攻撃リスク減少

運用Tips:
  - 必要最低限のツールのみ登録
  - モデルにツール使用を促すプロンプト設計
  - 「○○について調べるにはfetchツールを使ってみて」等
```

---

## 📋 設定例

### 推奨構成（現在の構成ベース）

```json
{
  "mcpGateway": {
    "addr": ":9090",
    "baseURL": "http://localhost:9090",
    "type": "sse"
  },
  "mcpServers": {
    "__comment": "=== BUILT-IN (always enabled) ===",
    "__builtin": "time, fetch, git, memory, sequentialthinking",

    "__comment": "=== CORE TOOLS (no auth) ===",
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/github"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "serena": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "..."]
    },
    "mindbase": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "..."]
    },

    "__comment": "=== OPTIONAL (enable when needed) ===",
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "enabled": false  // E2Eテスト時のみ
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "mcp-server-sqlite", "--db-path", "/app/data.db"],
      "enabled": false  // DB操作時のみ
    },

    "__comment": "=== AUTH REQUIRED (enable via UI) ===",
    "tavily": {
      "command": "npx",
      "args": ["-y", "@tavily/mcp-server"],
      "env": { "TAVILY_API_KEY": "${TAVILY_API_KEY}" },
      "enabled": false  // Web検索必要時のみ
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      },
      "enabled": false  // Supabase開発時のみ
    }
  }
}
```

---

## 🎯 推奨アクション

### 即時実施

1. ✅ **Time強制使用ワークフロー** を `~/.claude/RULES.md` に追加
2. ✅ **Puppeteer/SQLite** を必要時のみ有効化（デフォルト無効）
3. ✅ **Tavily有効化時** はFetchと競合しないよう注意

### プロジェクト開始時

1. ✅ 必要なMCPのみ有効化（DB連携、Web検索等）
2. ✅ 不要なMCPは無効化（トークン節約）
3. ✅ セキュリティ設定確認（認証情報、RLS等）

### 定期レビュー

1. ✅ 月次で使用MCPを見直し
2. ✅ 不要なツールを無効化
3. ✅ トークン使用量をモニタリング

---

## 🔗 参考文献

- Claude公式ドキュメント
- AIRIS MCP Gateway公式ドキュメント
- SuperClaude Framework（`~/.claude/MCP_*.md`）
- Anthropic MCP仕様

---

## 📝 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2025-10-16 | 初版作成、現在の構成評価、Time強制使用ワークフロー追加 |
| 2025-10-17 | Memory vs MindBase責務分離セクション追加、LLM暴走防止の仕組み追記 |

---

**注意**: このドキュメントは現在の構成（2025年10月時点）をベースに作成されています。新しいMCPサーバー追加時やプロジェクト要件変更時は適宜見直してください。
