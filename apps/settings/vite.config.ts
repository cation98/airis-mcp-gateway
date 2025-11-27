import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import AutoImport from 'unplugin-auto-import/vite'

const require = createRequire(import.meta.url)
const reactPath = require.resolve('react')
const reactJsxRuntimePath = require.resolve('react/jsx-runtime')
const reactJsxDevRuntimePath = require.resolve('react/jsx-dev-runtime')
const reactDomPath = require.resolve('react-dom')
const reactDomClientPath = require.resolve('react-dom/client')

const base = process.env.BASE_PATH || '/'
const isPreview = process.env.IS_PREVIEW ? true : false
const serverPort = Number(
  process.env.VITE_DEV_SERVER_PORT ??
  process.env.PORT ??
  process.env.VITE_PORT ??
  process.env.DEV_SERVER_PORT ??
  5273
)
const serverHost = process.env.VITE_DEV_SERVER_HOST ?? process.env.HOST ?? '0.0.0.0'
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview)
  },
  plugins: [
    tailwindcss(),
    react(),
    AutoImport({
      imports: [
        {
          'react': [
            'React',
            'useState',
            'useEffect',
            'useContext',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useLayoutEffect',
            'useDebugValue',
            'useDeferredValue',
            'useId',
            'useInsertionEffect',
            'useSyncExternalStore',
            'useTransition',
            'startTransition',
            'lazy',
            'memo',
            'forwardRef',
            'createContext',
            'createElement',
            'cloneElement',
            'isValidElement'
          ]
        },
        {
          'react-router-dom': [
            'useNavigate',
            'useLocation',
            'useParams',
            'useSearchParams',
            'Link',
            'NavLink',
            'Navigate',
            'Outlet'
          ]
        },
        // React i18n
        {
          'react-i18next': [
            'useTranslation',
            'Trans'
          ]
        }
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    sourcemap: true,
    outDir: 'out',
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: 'react/jsx-dev-runtime', replacement: reactJsxDevRuntimePath },
      { find: 'react/jsx-runtime', replacement: reactJsxRuntimePath },
      { find: 'react-dom/client', replacement: reactDomClientPath },
      { find: 'react-dom', replacement: reactDomPath },
      { find: 'react', replacement: reactPath }
    ],
    dedupe: ['react', 'react-dom']
  },
  server: command === 'serve' ? {
    port: serverPort,
    host: serverHost,
    proxy: {
      '/api': {
        target: 'http://api:9900',
        changeOrigin: true,
        ws: true
      }
    }
  } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true
  }
}))
