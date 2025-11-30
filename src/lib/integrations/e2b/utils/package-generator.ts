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
      // Tier 1: Critical components (forms, tabs, layout)
      '@radix-ui/react-label': '^2.1.0', // Forms (Label component)
      '@radix-ui/react-separator': '^1.1.0', // Layout dividers
      '@radix-ui/react-tabs': '^1.1.1', // Tabbed interfaces
      '@radix-ui/react-checkbox': '^1.1.2', // Form checkboxes
      '@radix-ui/react-switch': '^1.1.1', // Toggle switches
      // Tier 2: Common components (tooltips, popovers, accordions)
      '@radix-ui/react-tooltip': '^1.1.4', // Hover tooltips
      '@radix-ui/react-popover': '^1.1.2', // Popovers and dropdowns
      '@radix-ui/react-radio-group': '^1.2.1', // Radio button groups
      '@radix-ui/react-avatar': '^1.1.1', // User avatars
      '@radix-ui/react-accordion': '^1.2.1', // Collapsible sections
      '@radix-ui/react-progress': '^1.1.0', // Progress bars
      // Routing (used in multi-page apps ~40% of projects)
      'react-router-dom': '^6.28.0', // Multi-page navigation
      // Merge in any additional dependencies detected from code
      ...(config.additionalDependencies ?? {}),
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@types/node': '^20.14.10', // Required for path module in vite.config.ts
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

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
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
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
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
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config
`,

    'components.json': `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
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

/**
 * Generate Shadcn utility files
 * These are required for Shadcn components to work properly
 *
 * @returns Object with file paths and content for Shadcn utilities
 */
export function generateShadcnUtilities(): Record<string, string> {
  return {
    'src/lib/utils.ts': `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,
  };
}
