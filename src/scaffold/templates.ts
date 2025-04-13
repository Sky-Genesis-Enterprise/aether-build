/**
 * Project scaffolding templates
 */

import { writeFile, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Template type for project scaffolding
 */
export interface Template {
  name: string;
  description: string;
  files: Record<string, string | ((options: TemplateOptions) => string)>;
  dependencies: string[];
  devDependencies: string[];
  extraScripts?: Record<string, string>;
}

/**
 * Options for template rendering
 */
export interface TemplateOptions {
  projectName: string;
  typescript: boolean;
  author?: string;
  version?: string;
  description?: string;
  extraDependencies?: string[];
  extraDevDependencies?: string[];
}

/**
 * Create basic package.json content
 */
function createPackageJson(options: TemplateOptions): string {
  const scripts = {
    dev: 'aether dev',
    build: 'aether build',
    start: 'aether serve',
    lint: options.typescript ? 'eslint . --ext .ts,.tsx' : 'eslint .',
    test: 'echo "Error: no test specified" && exit 1'
  };

  return JSON.stringify(
    {
      name: options.projectName,
      version: options.version || '0.1.0',
      description: options.description || '',
      type: 'module',
      scripts,
      keywords: [],
      author: options.author || '',
      license: 'MIT',
      dependencies: {},
      devDependencies: {}
    },
    null,
    2
  );
}

/**
 * Create basic README.md content
 */
function createReadme(options: TemplateOptions): string {
  return `# ${options.projectName}

${options.description || 'A project scaffolded with Aether Build.'}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Serve production build
npm run start
\`\`\`

## Project Structure

- \`src/\` - Source code
- \`public/\` - Static assets
- \`dist/\` - Production build

## Built With

- [Aether Build](https://github.com/aether/aether-build) - Fast, modern build tool
`;
}

/**
 * Create basic .gitignore content
 */
function createGitignore(): string {
  return `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Dependencies
node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;
}

/**
 * Create aether.config.ts/js file
 */
function createAetherConfig(options: TemplateOptions): string {
  if (options.typescript) {
    return `import { definePlugin, type AetherConfig } from 'aether-build';

const config: AetherConfig = {
  // Project metadata
  name: '${options.projectName}',

  // Build options
  entry: './src/index.ts',
  outDir: './dist',

  // Development server options
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    watch: ['src/**/*', 'public/**/*']
  },

  // Build optimizations
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },

  // Plugin system
  plugins: [],

  // Aliases for import resolution
  alias: {
    '@': './src'
  }
};

export default config;`;
  } else {
    return `/** @type {import('aether-build').AetherConfig} */
const config = {
  // Project metadata
  name: '${options.projectName}',

  // Build options
  entry: './src/index.js',
  outDir: './dist',

  // Development server options
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    watch: ['src/**/*', 'public/**/*']
  },

  // Build optimizations
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },

  // Plugin system
  plugins: [],

  // Aliases for import resolution
  alias: {
    '@': './src'
  }
};

export default config;`;
  }
}

/**
 * Create tsconfig.json file
 */
function createTsConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}`;
}

// Available templates

/**
 * Vanilla JavaScript template
 */
export const vanillaTemplate: Template = {
  name: 'vanilla',
  description: 'Vanilla JavaScript template',
  dependencies: [],
  devDependencies: ['aether-build', 'eslint'],
  files: {
    'package.json': createPackageJson,
    'README.md': createReadme,
    '.gitignore': createGitignore,
    'aether.config.js': createAetherConfig,
    'src/index.js': `// Entry point for your application

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<h1>Hello, Aether!</h1>';
  }
});
`,
    'src/style.css': `html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
`,
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether App</title>
  <link rel="stylesheet" href="/src/style.css">
  <script type="module" src="/src/index.js"></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>`
  }
};

/**
 * Vanilla TypeScript template
 */
export const typescriptTemplate: Template = {
  name: 'typescript',
  description: 'Vanilla TypeScript template',
  dependencies: [],
  devDependencies: ['aether-build', 'typescript', 'eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser'],
  files: {
    'package.json': createPackageJson,
    'README.md': createReadme,
    '.gitignore': createGitignore,
    'aether.config.ts': createAetherConfig,
    'tsconfig.json': createTsConfig,
    'src/index.ts': `// Entry point for your application

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<h1>Hello, Aether!</h1>';
  }
});
`,
    'src/style.css': `html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
`,
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether App</title>
  <link rel="stylesheet" href="/src/style.css">
  <script type="module" src="/src/index.ts"></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>`
  }
};

/**
 * React JavaScript template
 */
export const reactTemplate: Template = {
  name: 'react',
  description: 'React template with JSX',
  dependencies: ['react', 'react-dom'],
  devDependencies: ['aether-build', 'eslint', 'eslint-plugin-react', 'eslint-plugin-react-hooks'],
  extraScripts: {
    dev: 'aether dev --open'
  },
  files: {
    'package.json': createPackageJson,
    'README.md': createReadme,
    '.gitignore': createGitignore,
    'aether.config.js': (options: TemplateOptions) => {
      const config = JSON.parse(createAetherConfig(options));
      // Add React plugin
      config.plugins = ['reactPlugin()'];
      return `/** @type {import('aether-build').AetherConfig} */
import { reactPlugin } from 'aether-build';

const config = ${JSON.stringify(config, null, 2)};

export default config;`;
    },
    'src/App.jsx': `import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Aether + React</h1>
        <p>
          <button type="button" onClick={() => setCount(count => count + 1)}>
            count is: {count}
          </button>
        </p>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </header>
    </div>
  );
}
`,
    'src/App.css': `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: center;
  align-items: center;
}

.App-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

button {
  font-size: calc(10px + 0.5vmin);
  padding: 0.5em 1em;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}
`,
    'src/index.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    'src/index.css': `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
}
`,
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aether React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.jsx"></script>
  </body>
</html>`
  }
};

/**
 * React TypeScript template
 */
export const reactTsTemplate: Template = {
  name: 'react-ts',
  description: 'React template with TypeScript',
  dependencies: ['react', 'react-dom'],
  devDependencies: ['aether-build', 'typescript', '@types/react', '@types/react-dom', 'eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', 'eslint-plugin-react', 'eslint-plugin-react-hooks'],
  extraScripts: {
    dev: 'aether dev --open'
  },
  files: {
    'package.json': createPackageJson,
    'README.md': createReadme,
    '.gitignore': createGitignore,
    'aether.config.ts': (options: TemplateOptions) => `import { reactPlugin, type AetherConfig } from 'aether-build';

const config: AetherConfig = {
  // Project metadata
  name: '${options.projectName}',

  // Build options
  entry: './src/index.tsx',
  outDir: './dist',

  // Development server options
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    watch: ['src/**/*', 'public/**/*']
  },

  // Build optimizations
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },

  // Plugin system
  plugins: [
    // Add React plugin
    reactPlugin({
      fastRefresh: true
    })
  ],

  // Aliases for import resolution
  alias: {
    '@': './src'
  }
};

export default config;`,
    'tsconfig.json': createTsConfig,
    'src/App.tsx': `import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Aether + React + TypeScript</h1>
        <p>
          <button type="button" onClick={() => setCount(count => count + 1)}>
            count is: {count}
          </button>
        </p>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </header>
    </div>
  );
}
`,
    'src/App.css': `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: center;
  align-items: center;
}

.App-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

button {
  font-size: calc(10px + 0.5vmin);
  padding: 0.5em 1em;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}
`,
    'src/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    'src/index.css': `
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
}
`,
    'src/vite-env.d.ts': `/// <reference types="aether-build/types" />
`,
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aether React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>`
  }
};

/**
 * Vue JavaScript template
 */
export const vueTemplate: Template = {
  name: 'vue',
  description: 'Vue template with JavaScript',
  dependencies: ['vue'],
  devDependencies: ['aether-build', 'eslint', 'eslint-plugin-vue'],
  extraScripts: {
    dev: 'aether dev --open'
  },
  files: {
    'package.json': createPackageJson,
    'README.md': createReadme,
    '.gitignore': createGitignore,
    'aether.config.js': (options: TemplateOptions) => `/** @type {import('aether-build').AetherConfig} */
import { vuePlugin } from 'aether-build';

const config = {
  // Project metadata
  name: '${options.projectName}',

  // Build options
  entry: './src/main.js',
  outDir: './dist',

  // Development server options
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    watch: ['src/**/*', 'public/**/*']
  },

  // Build optimizations
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },

  // Plugin system
  plugins: [
    // Add Vue plugin
    vuePlugin({
      hmr: true
    })
  ],

  // Aliases for import resolution
  alias: {
    '@': './src'
  }
};

export default config;`,
    'src/App.vue': `<template>
  <div class="app">
    <header>
      <h1>Aether + Vue</h1>
      <button @click="count++">count is {{ count }}</button>
      <p>
        Edit <code>src/App.vue</code> and save to test HMR
      </p>
    </header>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      count: 0
    }
  }
}
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: center;
  align-items: center;
}

header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

button {
  font-size: calc(10px + 0.5vmin);
  padding: 0.5em 1em;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #42b883;
}
</style>
`,
    'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
`,
    'src/style.css': `
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
}
`,
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aether Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`
  }
};

// Export all available templates
export const templates: Record<string, Template> = {
  vanilla: vanillaTemplate,
  typescript: typescriptTemplate,
  react: reactTemplate,
  'react-ts': reactTsTemplate,
  vue: vueTemplate
};
