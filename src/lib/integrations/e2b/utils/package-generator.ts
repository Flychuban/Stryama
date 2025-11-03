/**
 * Package.json Generator
 *
 * Generates framework-specific package.json files for E2B sandboxes
 */

import type { Framework } from '@prisma/client';

export interface PackageJsonConfig {
  name: string;
  version?: string;
  description?: string;
}

/**
 * Generate a package.json file based on the project framework
 */
export function generatePackageJson(
  framework: Framework,
  config: PackageJsonConfig = { name: 'project' }
): string {
  const basePackage = {
    name: config.name.toLowerCase().replace(/\s+/g, '-'),
    version: config.version ?? '0.1.0',
    description: config.description ?? `A ${framework.toLowerCase()} project`,
    private: true,
  };

  let packageJson: Record<string, unknown>;

  switch (framework) {
    case 'REACT':
      packageJson = {
        ...basePackage,
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
        },
      };
      break;

    case 'NEXTJS':
      packageJson = {
        ...basePackage,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          next: '^15.1.6',
        },
        devDependencies: {
          '@types/node': '^22',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          typescript: '^5',
          eslint: '^9',
          'eslint-config-next': '^15.1.6',
        },
      };
      break;

    case 'VUE':
      packageJson = {
        ...basePackage,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: {
          vue: '^3.5.13',
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^5.2.1',
          vite: '^6.0.5',
          typescript: '^5.7.3',
          'vue-tsc': '^2.2.0',
        },
      };
      break;

    case 'VANILLA':
      packageJson = {
        ...basePackage,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        devDependencies: {
          vite: '^6.0.5',
          typescript: '^5.7.3',
        },
      };
      break;

    default:
      // Default to vanilla
      packageJson = {
        ...basePackage,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        devDependencies: {
          vite: '^6.0.5',
        },
      };
  }

  return JSON.stringify(packageJson, null, 2);
}

/**
 * Generate essential entry point files for each framework
 * These are required for the dev server to actually serve content
 */
export function generateEntryPointFiles(
  framework: Framework
): Record<string, string> {
  const files: Record<string, string> = {};

  switch (framework) {
    case 'REACT':
      // index.html
      files['index.html'] = `<!DOCTYPE html>
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
`;

      // src/main.tsx
      files['src/main.tsx'] = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

      // src/App.tsx (placeholder - AI will replace this)
      files['src/App.tsx'] = `import { useState } from 'react'

function App() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>React App</h1>
      <p>Loading your application...</p>
    </div>
  )
}

export default App
`;

      // src/index.css
      files['src/index.css'] = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
      break;

    case 'NEXTJS':
      // app/layout.tsx
      files['app/layout.tsx'] = `export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`;

      // app/page.tsx (placeholder - AI will replace this)
      files['app/page.tsx'] = `export default function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Next.js App</h1>
      <p>Loading your application...</p>
    </main>
  )
}
`;
      break;

    case 'VUE':
      // index.html
      files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

      // src/main.ts
      files['src/main.ts'] = `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`;

      // src/App.vue (placeholder - AI will replace this)
      files['src/App.vue'] = `<template>
  <div style="padding: 2rem; text-align: center">
    <h1>Vue App</h1>
    <p>Loading your application...</p>
  </div>
</template>

<script setup lang="ts">
</script>
`;
      break;

    case 'VANILLA':
      // index.html
      files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

      // src/main.ts (placeholder - AI will replace this)
      files['src/main.ts'] = `import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = \`
  <div>
    <h1>Hello Vite!</h1>
    <p>Loading your application...</p>
  </div>
\`
`;

      // src/style.css
      files['src/style.css'] = `body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

#app {
  padding: 2rem;
  text-align: center;
}
`;
      break;
  }

  return files;
}

/**
 * Generate essential config files for each framework
 */
export function generateConfigFiles(
  framework: Framework
): Record<string, string> {
  const configs: Record<string, string> = {};

  switch (framework) {
    case 'REACT':
      // vite.config.ts
      configs['vite.config.ts'] = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Allow all hosts for E2B dynamic hostnames
    hmr: {
      clientPort: 5173,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
`;

      // tsconfig.json
      configs['tsconfig.json'] = `{
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
`;
      break;

    case 'NEXTJS':
      // tsconfig.json for Next.js
      configs['tsconfig.json'] = `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

      // next.config.js
      configs['next.config.js'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
`;
      break;

    case 'VUE':
      // vite.config.ts
      configs['vite.config.ts'] = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Allow all hosts for E2B dynamic hostnames
    hmr: {
      clientPort: 5173,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
`;

      // tsconfig.json
      configs['tsconfig.json'] = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
`;
      break;

    case 'VANILLA':
      // vite.config.ts
      configs['vite.config.ts'] = `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Allow all hosts for E2B dynamic hostnames
    hmr: {
      clientPort: 5173,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
`;

      // tsconfig.json
      configs['tsconfig.json'] = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`;
      break;
  }

  return configs;
}

/**
 * Get the dev server command for a framework
 */
export function getDevCommand(framework: Framework): string {
  switch (framework) {
    case 'NEXTJS':
      return 'npm run dev';
    case 'REACT':
    case 'VUE':
    case 'VANILLA':
    default:
      return 'npm run dev';
  }
}

/**
 * Get the default port for a framework
 */
export function getDefaultPort(framework: Framework): number {
  switch (framework) {
    case 'NEXTJS':
      return 3000;
    case 'REACT':
    case 'VUE':
    case 'VANILLA':
    default:
      return 5173; // Vite default
  }
}
