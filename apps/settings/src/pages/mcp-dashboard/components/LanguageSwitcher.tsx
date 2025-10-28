import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLanguage = useMemo(() => {
    const [language] = i18n.language.split('-');
    return language === 'ja' ? 'ja' : 'en';
  }, [i18n.language]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className="hidden sm:inline">{t('dashboard.language.label')}</span>
      <select
        value={currentLanguage}
        onChange={handleChange}
        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('dashboard.language.ariaLabel')}
      >
        <option value="en">{t('common.language.english')}</option>
        <option value="ja">{t('common.language.japanese')}</option>
      </select>
    </label>
  );
}
