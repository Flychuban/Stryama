/**
 * Package.json Generator
 *
 * Generates React+Vite package.json and config files for E2B sandboxes.
 * This app is specialized for React+Vite web applications.
 */

import { FRAMEWORK_CONFIG } from '@/lib/constants/framework';

export interface PackageJsonConfig {
  name: string;
  version?: string;
  description?: string;
}

/**
 * Generate a package.json file for React+Vite projects
 */
export function generatePackageJson(
  config: PackageJsonConfig = { name: 'project' }
): string {
  const packageJson = {
    name: config.name.toLowerCase().replace(/\s+/g, '-'),
    version: config.version ?? '0.1.0',
    description: config.description ?? 'A React + Vite project',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      lint: 'eslint .',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@vitejs/plugin-react': '^4.3.4',
      vite: '^6.0.5',
      eslint: '^9.17.0',
      'eslint-plugin-react-hooks': '^5.0.0',
      'eslint-plugin-react-refresh': '^0.4.16',
      typescript: '^5.7.3',
      'patch-package': '^8.0.0', // Required by rollup postinstall scripts
    },
  };

  return JSON.stringify(packageJson, null, 2);
}

/**
 * Generate essential entry point files for React+Vite
 * These are required for the dev server to serve content
 */
export function generateEntryPointFiles(): Record<string, string> {
  return {
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,

    'src/App.tsx': `import { useState } from 'react'

function App() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>React App</h1>
      <p>Loading your application...</p>
    </div>
  )
}

export default App
`,

    'src/index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
  };
}

/**
 * Generate essential config files for React+Vite
 */
export function generateConfigFiles(): Record<string, string> {
  return {
    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: ${FRAMEWORK_CONFIG.port},
    strictPort: true,
    allowedHosts: true, // Allow all hosts for E2B dynamic hostnames
    hmr: {
      clientPort: ${FRAMEWORK_CONFIG.port},
    },
  },
  preview: {
    host: '0.0.0.0',
    port: ${FRAMEWORK_CONFIG.port},
    strictPort: true,
    allowedHosts: true,
  },
})
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
  };
}

/**
 * Get the dev server command for React+Vite
 */
export function getDevCommand(): string {
  return FRAMEWORK_CONFIG.devCommand;
}

/**
 * Get the default port for React+Vite
 */
export function getDefaultPort(): number {
  return FRAMEWORK_CONFIG.port;
}
