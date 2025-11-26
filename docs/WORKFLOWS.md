# MCP Server Workflows

このドキュメントは、AIRIS MCP Gateway でのサーバー使用パターンとベストプラクティスを定義します。

## 基本原則

1. **デフォルトONは最小限**(5サーバーのみ)
2. **context7を優先** - ハルシネーション防止、最新情報取得
3. **必要な時だけ動的にON** - LLMが `airis-mcp-gateway-control` 経由でenable/disable

## デフォルトONサーバー(常時利用可能)

### 必須サーバー
- **airis-mcp-gateway-control** - サーバー管理(enable/disable)
- **filesystem** - ファイル操作
- **memory** - 短期記憶

### 推奨サーバー
- **context7** - 最新情報検索、公式ドキュメント取得
- **time** - 現在時刻取得

**トークン使用量:** 約 1,250 tokens (vs. 全サーバーONで 12,500 tokens)

## ワークフロー別パターン

### 1. 調べ物・最新情報検索

#### context7使用パターン (推奨)

```typescript
// ❌ 悪い例 (ハルシネーションリスク)
async function researchBadExample(query: string) {
  // LLMの知識だけで回答 → 2025-12-21とか間違った日付を生成
  return `${query}について、2025年12月21日時点では...`;  // 今日は11月21日!
}

// ✅ 良い例 (context7で正確な情報取得)
async function researchGoodExample(query: string) {
  // context7 が自動的に現在日時を考慮して最新情報を検索
  const results = await callTool('context7_search', {
    query: query,  // "React 19 新機能" など
    // context7内部で自動的に2025-11現在の情報を取得
  });
  return results;
}
```

**メリット:**
- ✅ 最新情報(2025-11-21時点)を自動取得
- ✅ ハルシネーション防止
- ✅ 公式ドキュメント優先
- ✅ `time`サーバー不要(context7が内部で時刻認識)

#### time使用パターン (明示的な日時が必要な場合のみ)

```typescript
// 明示的に現在時刻を取得する必要がある場合
async function researchWithExplicitTime(query: string) {
  // 1. 現在時刻取得
  const currentTime = await callTool('time', {});
  // → "2025-11-21T10:30:00+09:00"

  // 2. 時刻を含めて検索
  const results = await callTool('context7_search', {
    query: `${query} (as of ${currentTime})`,
  });

  return results;
}
```

**使用ケース:**
- 時刻情報を明示的に含める必要がある場合
- タイムスタンプ付きログ生成
- スケジュール計算

### 2. GitHub操作ワークフロー

```typescript
async function workWithGitHub(task: string) {
  // 1. GitHubサーバー有効化
  await callTool('enable_mcp_server', { server_name: 'github' });

  // 2. GitHub操作
  const result = await callTool('github_create_issue', {
    repo: 'owner/repo',
    title: 'Bug report',
    body: '...'
  });

  // 3. タスク完了後は無効化(トークン節約)
  await callTool('disable_mcp_server', { server_name: 'github' });

  return result;
}
```

### 3. データベース操作ワークフロー

```typescript
async function databaseTask(query: string) {
  // 1. 必要なDBサーバー有効化
  await callTool('enable_mcp_server', { server_name: 'supabase' });

  // 2. クエリ実行
  const data = await callTool('supabase_query', { sql: query });

  // 3. 無効化
  await callTool('disable_mcp_server', { server_name: 'supabase' });

  return data;
}
```

### 4. 複数サーバー連携

```typescript
async function complexResearch(topic: string) {
  // 1. 現在時刻確認(必要な場合のみ)
  const now = await callTool('time', {});

  // 2. context7で最新情報取得
  const docs = await callTool('context7_search', { query: topic });

  // 3. 必要に応じてWeb検索(Tavily)
  if (docs.length === 0) {
    await callTool('enable_mcp_server', { server_name: 'tavily' });
    const webResults = await callTool('tavily_search', { query: topic });
    await callTool('disable_mcp_server', { server_name: 'tavily' });
    return webResults;
  }

  return docs;
}
```

## ベストプラクティス

### ✅ DO

1. **context7を第一選択** - 最新情報、公式ドキュメント優先
2. **使用後は無効化** - トークン節約
3. **エラーハンドリング** - enable/disableが失敗しても続行
4. **現在時刻が必要な時だけtime使用** - context7で十分な場合が多い

### ❌ DON'T

1. **ハルシネーション日付** - "2025-12-21"など不正確な情報を生成しない
2. **常時全サーバーON** - トークン無駄遣い
3. **time強制使用** - context7で済む場合は不要
4. **手動設定依存** - LLMが自動でenable/disable判断

## パフォーマンス比較

| パターン | トークン使用量 | レスポンス速度 | 正確性 |
|---------|--------------|--------------|--------|
| 全サーバーON | 12,500 tokens | 遅い | 高 |
| デフォルト(5個) | 1,250 tokens | 高速 | 高 |
| 動的ON/OFF | 1,250-3,000 tokens | 高速 | 高 |

**推奨:** デフォルト5個 + 必要時に動的ON/OFF

## 時刻関連の注意事項

### 現在時刻

**今日の日付: 2025-11-21** (November 21, 2025)

### ハルシネーション例

```typescript
// ❌ 絶対にやってはいけない
const today = "2025-12-21";  // 間違い!今日は11月21日

// ✅ 正しい方法
const today = await callTool('time', {});  // 正確な時刻取得
```

## まとめ

1. **デフォルトON**: 5サーバーのみ(1,250 tokens)
2. **調べ物**: context7優先(自動で最新情報)
3. **必要時のみON**: LLMが動的にenable/disable
4. **ハルシネーション防止**: context7使用、time明示取得

これにより、**90%トークン削減 + 正確性向上**を実現。
