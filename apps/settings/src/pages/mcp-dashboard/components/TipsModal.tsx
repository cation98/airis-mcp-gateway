
interface TipsModalProps {
  onClose: () => void;
}

export function TipsModal({ onClose }: TipsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <i className="ri-lightbulb-fill text-amber-600 mr-2"></i>
              MCP設定のベストプラクティス
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          <div className="space-y-6">
            {/* おすすめセット（API不要） */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
                <i className="ri-star-line mr-2"></i>
                おすすめMCPセット（API不要）
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Built-in（常時有効）:</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    <li><strong>time, fetch, git, memory, sequential-thinking</strong></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-green-700 mb-2">Gateway（認証不要）:</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    <li><strong>filesystem</strong> - 必須</li>
                    <li><strong>context7</strong> - 必須（15,000+ライブラリドキュメント）</li>
                    <li><strong>serena</strong> - 推奨（コード理解）</li>
                    <li><strong>mindbase</strong> - 推奨（長期記憶・失敗学習）</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-green-700 mb-2">選択的:</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    <li><strong>puppeteer</strong> - E2Eテスト時のみ</li>
                    <li><strong>sqlite</strong> - DB操作時のみ</li>
                  </ul>
                </div>

                <div className="bg-green-100 p-3 rounded">
                  <h4 className="font-medium text-green-800 mb-1">理由:</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    <li>トークン効率◎（Fetch単独、軽量）</li>
                    <li>セキュリティ◎（外部API不要）</li>
                    <li>リソース: ~500MB</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* おすすめセット（APIあり） */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                <i className="ri-star-fill mr-2"></i>
                おすすめMCPセット（API利用時）
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-purple-700 mb-2">上記に加えて:</p>
                  <ul className="list-disc list-inside text-purple-700 space-y-1 ml-4">
                    <li><strong>tavily</strong> - AI検索（Fetch無効化推奨）</li>
                    <li><strong>supabase</strong> - Supabase開発時</li>
                    <li><strong>github</strong> - GitHub操作時</li>
                    <li><strong>brave-search</strong> - Web検索（Tavily併用時は非推奨）</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 重要なTips */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center">
                <i className="ri-alert-line mr-2"></i>
                重要なTips（トレードオフ）
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">検索ツールの競合回避:</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    <li><strong>Tavily ON → Fetch OFF推奨</strong>（機能重複回避）</li>
                    <li><strong>Tavily ON → Brave OFF推奨</strong>（検索ツール競合回避）</li>
                    <li>Tavily-extract と Fetch は同じ機能（URL内容取得）</li>
                  </ul>
                </div>

                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">パフォーマンス最適化:</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    <li>同時に有効にするMCPサーバーは10個以下を推奨</li>
                    <li>使用しない機能は無効化してリソース節約</li>
                    <li>APIキーが必要なサーバーは必要時のみ有効化</li>
                  </ul>
                </div>

                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">セキュリティ:</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    <li>APIキーは環境変数で管理</li>
                    <li>不要な外部API接続は避ける</li>
                    <li>定期的にAPIキーをローテーション</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* カスタム設定 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <i className="ri-settings-line mr-2"></i>
                カスタム設定
              </h3>
              
              <div className="text-sm text-gray-700">
                <p className="mb-2">プロジェクトの要件に応じて追加可能なオプション:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Magic</strong> - UIコンポーネント生成</li>
                  <li><strong>MorphLLM</strong> - 高速コード修正</li>
                  <li><strong>OpenAI/Anthropic</strong> - 追加AI機能</li>
                  <li><strong>Slack/Notion</strong> - チーム連携</li>
                  <li><strong>Stripe/Shopify</strong> - EC機能</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
