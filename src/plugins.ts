import type { AetherConfig } from './config.js';

/**
 * Lifecycle hook contexts
 */
export interface InitContext {
  config: AetherConfig;
}

export interface ConfigContext {
  config: AetherConfig;
}

export interface BuildStartContext {
  config: AetherConfig;
}

export interface BuildContext {
  config: AetherConfig;
  filePath: string;
  content: string;
  code: string;
  map?: object;
}

export interface BuildEndContext {
  config: AetherConfig;
  outputs: Map<string, { code: string; map?: object }>;
}

export interface DevServerContext {
  config: AetherConfig;
  port: number;
  host: string;
}

export interface ResolveContext {
  config: AetherConfig;
  importerId?: string;
  importer?: string;
  source: string;
  resolved?: string;
}

/**
 * Plugin interface with all possible lifecycle hooks
 */
export interface Plugin {
  name: string;

  // Configuration hooks
  configResolved?(config: AetherConfig): void | Promise<void>;
  configureServer?(server: any): void | Promise<void>;

  // Build hooks
  buildStart?(ctx: BuildStartContext): void | Promise<void>;
  transform?(ctx: BuildContext): string | { code: string; map?: object } | null | Promise<string | { code: string; map?: object } | null>;
  resolveId?(ctx: ResolveContext): string | null | Promise<string | null>;
  load?(id: string): string | null | Promise<string | null>;
  buildEnd?(ctx: BuildEndContext): void | Promise<void>;

  // Dev server hooks
  configureDevServer?(ctx: DevServerContext): void | Promise<void>;
  handleHotUpdate?(ctx: { file: string; server: any }): void | Promise<void>;

  // Misc hooks
  watchChange?(id: string, change: { event: 'create' | 'update' | 'delete' }): void | Promise<void>;
  closeBundle?(): void | Promise<void>;
}

/**
 * Apply a plugin hook to a context
 */
export async function applyPluginHook<T, R>(
  plugins: Plugin[],
  hookName: keyof Plugin,
  context: T
): Promise<R | null> {
  let result: R | null = null;

  for (const plugin of plugins) {
    const hook = plugin[hookName];
    if (typeof hook === 'function') {
      try {
        const hookResult = await (hook as Function)(context);
        if (hookResult !== null && hookResult !== undefined) {
          result = hookResult as R;
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name} at hook ${String(hookName)}:`, error);
        throw error;
      }
    }
  }

  return result;
}

/**
 * Load plugins from the configuration
 */
export async function loadPlugins(
  plugins: (Plugin | (() => Plugin | Promise<Plugin>))[]
): Promise<Plugin[]> {
  const resolvedPlugins: Plugin[] = [];

  for (const plugin of plugins) {
    try {
      // If plugin is a function, call it to get the actual plugin
      const resolvedPlugin = typeof plugin === 'function' ? await plugin() : plugin;

      if (!resolvedPlugin || !resolvedPlugin.name) {
        console.warn('Plugin without name detected. Make sure all plugins have a name property.');
      }

      resolvedPlugins.push(resolvedPlugin);
    } catch (error) {
      console.error('Failed to load plugin:', error);
      throw error;
    }
  }

  return resolvedPlugins;
}

/**
 * Create a simple plugin
 */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

/**
 * Common plugin for handling TypeScript/JSX files using esbuild
 */
export function typescriptPlugin(options = {}): Plugin {
  return {
    name: 'aether:typescript',
    async transform(ctx) {
      const { filePath, code } = ctx;

      // Only transform .ts, .tsx, .jsx files
      if (!/\.(tsx?|jsx)$/.test(filePath)) {
        return null;
      }

      // This is a placeholder. In a real implementation, we would use esbuild to transform
      console.log(`Transforming ${filePath} with TypeScript plugin`);

      // Load esbuild when needed
      const { transform } = await import('esbuild');

      const result = await transform(code, {
        loader: filePath.endsWith('x') ? 'tsx' : 'ts',
        target: 'es2022',
        format: 'esm',
        sourcemap: true,
        ...options
      });

      return {
        code: result.code,
        map: JSON.parse(result.map || '{}')
      };
    }
  };
}
