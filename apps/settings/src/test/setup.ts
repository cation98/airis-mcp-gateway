import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (options && typeof options === 'object' && Object.keys(options).length > 0) {
          const extra = Object.entries(options)
            .map(([optionKey, value]) => `${optionKey}:${String(value)}`)
            .join(',');
          return `${key}${extra ? `(${extra})` : ''}`;
        }
        return key;
      },
      i18n: {
        language: 'en',
        changeLanguage: vi.fn(),
      },
    }),
    Trans: ({ children }: { children?: ReactNode }) => (children ?? null),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
