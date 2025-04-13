import { join, dirname, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { type Plugin, type ResolveContext } from '../plugins.js';
import { type AetherConfig } from '../config.js';

// Regular expressions for matching different types of imports
const IMPORT_RE = /(?:import(?:["'\s]*(?:[\w*${}\n\r\t, ]+)from\s*)?["'\s])([@\w\s./\-$]+)(?:["'\s].*)/g;
const DYNAMIC_IMPORT_RE = /import\((?:['"`])([@\w\s./\-$]+)(?:['"`])\)/g;
const EXPORT_FROM_RE = /export\s+(?:[\w*${}\n\r\t, ]+)\s+from\s+(?:["'`])([@\w\s./\-$]+)(?:["'`])/g;
const REQUIRE_RE = /(?:require\(\s*['"`])([@\w\s./\-$]+)(?:['"`]\s*\))/g;

export interface DependencyInfo {
  id: string;
  resolved?: string;
  isExternal: boolean;
}

/**
 * Extracts all import statements from a file's content
 */
export function extractImports(code: string): string[] {
  const imports = new Set<string>();

  // Find all imports
  let match;

  // Standard imports
  while ((match = IMPORT_RE.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // Dynamic imports
  while ((match = DYNAMIC_IMPORT_RE.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // Export from
  while ((match = EXPORT_FROM_RE.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // CommonJS require
  while ((match = REQUIRE_RE.exec(code)) !== null) {
    imports.add(match[1]);
  }

  return [...imports];
}

/**
 * Resolve a module specifier to an absolute path
 */
export async function resolveModuleSpecifier(
  specifier: string,
  importer: string,
  config: AetherConfig,
  plugins: Plugin[]
): Promise<DependencyInfo> {
  // Return value
  const depInfo: DependencyInfo = {
    id: specifier,
    isExternal: false
  };

  // Skip URLs
  if (specifier.startsWith('http:') || specifier.startsWith('https:') || specifier.startsWith('//')) {
    depInfo.isExternal = true;
    return depInfo;
  }

  // Skip built-in Node.js modules and bare imports (likely from node_modules)
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.includes(':')) {
    depInfo.isExternal = true;

    // Check if we have an alias for this module
    if (config.alias && config.alias[specifier]) {
      depInfo.id = config.alias[specifier];
      depInfo.isExternal = false;
    }

    // If still external, we're done
    if (depInfo.isExternal) {
      return depInfo;
    }
  }

  // Create a resolve context for plugins
  const resolveContext: ResolveContext = {
    config,
    importer,
    source: specifier,
  };

  // Let plugins have a chance to resolve this
  for (const plugin of plugins) {
    if (plugin.resolveId) {
      const resolved = await plugin.resolveId(resolveContext);
      if (resolved) {
        depInfo.resolved = resolved;
        break;
      }
    }
  }

  // If not resolved by plugins, use our default resolution logic
  if (!depInfo.resolved) {
    const basedir = importer ? dirname(importer) : process.cwd();
    depInfo.resolved = resolveWithExtensions(specifier, basedir, config);
  }

  return depInfo;
}

/**
 * Resolves a module specifier, trying different extensions if needed
 */
function resolveWithExtensions(
  specifier: string,
  basedir: string,
  config: AetherConfig
): string | undefined {
  // If the specifier is already absolute, try it directly
  const isAbs = isAbsolute(specifier);
  const absoluteSpecifier = isAbs ? specifier : join(basedir, specifier);

  // If it exists as-is, return it
  if (existsSync(absoluteSpecifier)) {
    return absoluteSpecifier;
  }

  // Get extensions to try from config
  const extensions = config.resolve?.extensions || [
    '.ts', '.tsx', '.js', '.jsx', '.json'
  ];

  // Try with extensions
  for (const ext of extensions) {
    const withExt = `${absoluteSpecifier}${ext}`;
    if (existsSync(withExt)) {
      return withExt;
    }
  }

  // Try as a directory with index files
  for (const ext of extensions) {
    const indexFile = join(absoluteSpecifier, `index${ext}`);
    if (existsSync(indexFile)) {
      return indexFile;
    }
  }

  // Could not resolve
  return undefined;
}

/**
 * Process all dependencies in a file
 */
export async function processDependencies(
  filePath: string,
  content: string,
  config: AetherConfig,
  plugins: Plugin[]
): Promise<DependencyInfo[]> {
  const imports = extractImports(content);
  const dependencies: DependencyInfo[] = [];

  for (const importSpecifier of imports) {
    const depInfo = await resolveModuleSpecifier(importSpecifier, filePath, config, plugins);
    dependencies.push(depInfo);
  }

  return dependencies;
}
