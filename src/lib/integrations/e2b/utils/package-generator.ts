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
  additionalDependencies?: Record<string, string>;
  additionalDevDependencies?: Record<string, string>;
}

/**
 * Generate a package.json file for React+Vite projects
 *
 * @param config - Configuration including name and optional additional dependencies
 * @returns JSON string of package.json
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
      // Essential UI packages (pre-installed for first-time compilation success)
      // ShadCN UI core utilities (used in 90%+ of projects)
      'lucide-react': '^0.460.0', // Icons - mentioned in base prompt
      'class-variance-authority': '^0.7.1', // ShadCN component variants
      clsx: '^2.1.1', // Conditional classnames utility
      'tailwind-merge': '^2.6.0', // Merge Tailwind classes without conflicts
      // Common ShadCN/Radix UI components (used in 50%+ of projects)
      '@radix-ui/react-slot': '^1.1.0', // ShadCN base component
      '@radix-ui/react-dialog': '^1.1.2', // Modals (CRUD, Dashboard)
      '@radix-ui/react-dropdown-menu': '^2.1.2', // Dropdowns (Dashboard)
      '@radix-ui/react-select': '^2.1.2', // Select inputs (CRUD, Dashboard)
      // Routing (used in multi-page apps ~40% of projects)
      'react-router-dom': '^6.28.0', // Multi-page navigation
      // Merge in any additional dependencies detected from code
      ...(config.additionalDependencies ?? {}),
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
      // Tailwind CSS and dependencies (matching main project versions)
      tailwindcss: '^3.4.0',
      autoprefixer: '^10.4.21',
      postcss: '^8.5.6',
      // Merge in any additional dev dependencies
      ...(config.additionalDevDependencies ?? {}),
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

    'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;
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

    'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,

    'tailwind.config.ts': `import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
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
