/**
 * HMR (Hot Module Replacement) Runtime
 *
 * This module provides functionality to:
 * 1. Inject HMR runtime code into modules
 * 2. Track the module dependency graph for precise updates
 * 3. Generate HMR boundary code for modules
 */

import { type Plugin } from '../plugins.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read the HMR client code
const __dirname = dirname(fileURLToPath(import.meta.url));
const hmrClientCode = readFileSync(join(__dirname, 'client-dist.js'), 'utf-8');

/**
 * Provides a serialized version of the HMR client to inject into HTML
 */
export function getSerializedHMRClientCode(): string {
  return hmrClientCode;
}

/**
 * Create a plugin that injects the HMR runtime
 */
export function createHMRPlugin(): Plugin {
  return {
    name: 'aether:hmr',

    // Inject HMR capabilities into HTML
    async transform(ctx) {
      const { filePath, code, config } = ctx;

      // Only process in development mode
      if (!config.server) {
        return null;
      }

      // Inject HMR client into HTML
      if (filePath.endsWith('.html')) {
        // Simple injection into head tag
        return code.replace(
          '</head>',
          `<script type="module">
${hmrClientCode}
</script></head>`
        );
      }

      // Add HMR accept handlers to JavaScript/TypeScript modules
      if (/\.(js|ts|mjs|jsx|tsx)$/.test(filePath)) {
        // Don't transform node_modules files
        if (filePath.includes('node_modules')) {
          return null;
        }

        // Get module path as it would appear in the browser
        const modulePath = getBrowserModulePath(filePath, config);

        // Add HMR runtime support
        const hmrCode = `
// Injected by Aether HMR plugin
import.meta.hot = __AETHER_CREATE_HOT__(${JSON.stringify(modulePath)});
`;

        return code + hmrCode;
      }

      return null;
    }
  };
}

/**
 * Convert a file system path to a browser-compatible module path
 */
function getBrowserModulePath(filePath: string, config: any): string {
  // This is a simplified implementation
  // In a real-world scenario, we would handle base paths, publicDir, etc.

  // Simple approach: assume filePath is relative to the project root
  const root = process.cwd();

  // Make path relative to root
  let relativePath = filePath.startsWith(root)
    ? filePath.slice(root.length)
    : filePath;

  // Normalize path separators and ensure it starts with '/'
  relativePath = relativePath.replace(/\\/g, '/');
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  return relativePath;
}

/**
 * Create a hot module replacement boundary
 */
export function createHMRBoundary(filePath: string, acceptedDeps: string[] = []): string {
  if (acceptedDeps.length === 0) {
    // Self-accepting module
    return `
if (import.meta.hot) {
  import.meta.hot.accept();
}`;
  }

  // Accept specific dependencies
  return `
if (import.meta.hot) {
  import.meta.hot.acceptDeps([${acceptedDeps.map(dep => JSON.stringify(dep)).join(', ')}],
    (newModules) => {
      // Update logic for accepted dependencies
      console.log('[HMR] Accepting dependencies update in', ${JSON.stringify(filePath)});
    }
  );
}`;
}

/**
 * Generate a complete HMR-enabled module
 */
export function generateHMRModule(
  filePath: string,
  code: string,
  acceptedDeps: string[] = []
): string {
  const hmrBoundary = createHMRBoundary(filePath, acceptedDeps);

  return `${code}

// HMR boundary
${hmrBoundary}`;
}
