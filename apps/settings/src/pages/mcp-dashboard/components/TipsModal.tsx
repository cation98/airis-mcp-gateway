
import { useTranslation } from 'react-i18next';

interface TipsModalProps {
  onClose: () => void;
}

export function TipsModal({ onClose }: TipsModalProps) {
  const { t } = useTranslation();

  const gatewayItems = [
    { name: 'filesystem', description: t('tipsModal.sections.recommendedNoApi.gateway.items.filesystem') },
    { name: 'context7', description: t('tipsModal.sections.recommendedNoApi.gateway.items.context7') },
    { name: 'serena', description: t('tipsModal.sections.recommendedNoApi.gateway.items.serena') },
    { name: 'mindbase', description: t('tipsModal.sections.recommendedNoApi.gateway.items.mindbase') },
  ];

  const optionalItems = [
    { name: 'puppeteer', description: t('tipsModal.sections.recommendedNoApi.optional.items.puppeteer') },
    { name: 'sqlite', description: t('tipsModal.sections.recommendedNoApi.optional.items.sqlite') },
  ];

  const recommendedApiItems = [
    { name: 'tavily', description: t('tipsModal.sections.recommendedApi.items.tavily') },
    { name: 'supabase', description: t('tipsModal.sections.recommendedApi.items.supabase') },
    { name: 'github', description: t('tipsModal.sections.recommendedApi.items.github') },
    { name: 'brave-search', description: t('tipsModal.sections.recommendedApi.items.brave') },
  ];

  const tradeoffSearchItems = ['fetch', 'brave', 'extract'] as const;

  const performanceItems = ['limit', 'disable', 'apiOnly'] as const;

  const securityItems = ['env', 'avoid', 'rotate'] as const;

  const customItems = [
    { name: 'Magic', description: t('tipsModal.sections.custom.items.magic') },
    { name: 'MorphLLM', description: t('tipsModal.sections.custom.items.morphLLM') },
    { name: 'OpenAI/Anthropic', description: t('tipsModal.sections.custom.items.openAIAnthropic') },
    { name: 'Slack/Notion', description: t('tipsModal.sections.custom.items.slackNotion') },
    { name: 'Stripe/Shopify', description: t('tipsModal.sections.custom.items.stripeShopify') },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <i className="ri-lightbulb-fill text-amber-600 mr-2"></i>
              {t('tipsModal.title')}
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
                {t('tipsModal.sections.recommendedNoApi.title')}
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">{t('tipsModal.sections.recommendedNoApi.builtin.title')}</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    <li><strong>time, fetch, git, memory, sequential-thinking</strong></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-green-700 mb-2">{t('tipsModal.sections.recommendedNoApi.gateway.title')}</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    {gatewayItems.map(({ name, description }) => (
                      <li key={name}>
                        <strong>{name}</strong> - {description}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-green-700 mb-2">{t('tipsModal.sections.recommendedNoApi.optional.title')}</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    {optionalItems.map(({ name, description }) => (
                      <li key={name}>
                        <strong>{name}</strong> - {description}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-green-100 p-3 rounded">
                  <h4 className="font-medium text-green-800 mb-1">{t('tipsModal.sections.recommendedNoApi.reason.title')}</h4>
                  <ul className="list-disc list-inside text-green-700 space-y-1 ml-4">
                    {[
                      'tipsModal.sections.recommendedNoApi.reason.items.tokens',
                      'tipsModal.sections.recommendedNoApi.reason.items.security',
                      'tipsModal.sections.recommendedNoApi.reason.items.resources',
                    ].map((key) => (
                      <li key={key}>{t(key)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* おすすめセット（APIあり） */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                <i className="ri-star-fill mr-2"></i>
                {t('tipsModal.sections.recommendedApi.title')}
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-purple-700 mb-2">{t('tipsModal.sections.recommendedApi.description')}</p>
                  <ul className="list-disc list-inside text-purple-700 space-y-1 ml-4">
                    {recommendedApiItems.map(({ name, description }) => (
                      <li key={name}>
                        <strong>{name}</strong> - {description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 重要なTips */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center">
                <i className="ri-alert-line mr-2"></i>
                {t('tipsModal.sections.tradeoffs.title')}
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">{t('tipsModal.sections.tradeoffs.search.title')}</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    {tradeoffSearchItems.map((key) => (
                      <li key={key}>{t(`tipsModal.sections.tradeoffs.search.items.${key}`)}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">{t('tipsModal.sections.tradeoffs.performance.title')}</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    {performanceItems.map((key) => (
                      <li key={key}>{t(`tipsModal.sections.tradeoffs.performance.items.${key}`)}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-100 p-3 rounded">
                  <h4 className="font-medium text-amber-800 mb-2">{t('tipsModal.sections.tradeoffs.security.title')}</h4>
                  <ul className="list-disc list-inside text-amber-700 space-y-1 ml-4">
                    {securityItems.map((key) => (
                      <li key={key}>{t(`tipsModal.sections.tradeoffs.security.items.${key}`)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* カスタム設定 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <i className="ri-settings-line mr-2"></i>
                {t('tipsModal.sections.custom.title')}
              </h3>
              
              <div className="text-sm text-gray-700">
                <p className="mb-2">{t('tipsModal.sections.custom.description')}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {customItems.map(({ name, description }) => (
                    <li key={name}>
                      <strong>{name}</strong> - {description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              {t('common.actions.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
