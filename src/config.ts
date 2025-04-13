import { join } from 'node:path';
import { fileExists, readFile } from './utils/file.js';
import { type Plugin } from './plugins.js';

/**
 * Represents an Aether build configuration
 */
export interface AetherConfig {
  // Project metadata
  name?: string;
  version?: string;

  // Build options
  entry: string | string[] | Record<string, string>;
  outDir: string;

  // Development server options
  server?: {
    port?: number;
    host?: string;
    https?: boolean;
    open?: boolean;
    watch?: string | string[];
  };

  // Build optimizations
  optimize?: {
    minify?: boolean;
    target?: 'es2018' | 'es2020' | 'es2022' | 'esnext';
    sourcemap?: boolean | 'inline' | 'external';
    splitting?: boolean;
    treeshake?: boolean;
  };

  // Plugin system
  plugins?: Plugin[];

  // Custom options passed to specific plugins
  pluginOptions?: Record<string, unknown>;

  // Transformations and aliases
  alias?: Record<string, string>;
  resolve?: {
    extensions?: string[];
    conditions?: string[];
  };

  // Debug options
  debug?: {
    verbose?: boolean;
    logLevel?: 'info' | 'warn' | 'error' | 'silent';
    showDependencyGraph?: boolean;
  };

  // Custom options
  [key: string]: unknown;
}

/**
 * Default configuration values
 */
export const defaultConfig: AetherConfig = {
  entry: './src/index.ts',
  outDir: './dist',
  server: {
    port: 3000,
    host: 'localhost',
    open: false,
    watch: ['src/**/*']
  },
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default']
  },
  debug: {
    verbose: false,
    logLevel: 'info',
    showDependencyGraph: false
  },
  plugins: []
};

/**
 * Try to load the configuration file from the given directory
 */
export async function findConfigFile(
  dir: string
): Promise<string | null> {
  const configFileNames = [
    'aether.config.ts',
    'aether.config.js',
    'aether.config.mjs',
    'aether.config.json'
  ];

  for (const fileName of configFileNames) {
    const configPath = join(dir, fileName);
    if (fileExists(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Load and parse the configuration file
 */
export async function loadConfigFile(
  configPath: string
): Promise<AetherConfig> {
  try {
    if (configPath.endsWith('.json')) {
      const configContent = readFile(configPath);
      return JSON.parse(configContent);
    }

    // For TS/JS files, use dynamic import
    const configModule = await import(configPath);
    return configModule.default || configModule;
  } catch (error) {
    console.error(`Error loading config from ${configPath}:`, error);
    throw new Error(`Failed to load config from ${configPath}`);
  }
}

/**
 * Resolve the configuration by merging defaults with user config
 */
export async function resolveConfig(
  configPath?: string | null,
  overrides: Partial<AetherConfig> = {}
): Promise<AetherConfig> {
  let userConfig: Partial<AetherConfig> = {};

  // Try to find config if not specified
  if (!configPath) {
    configPath = await findConfigFile(process.cwd());
  }

  // Load user config if exists
  if (configPath) {
    userConfig = await loadConfigFile(configPath);
  }

  // Merge configurations with overrides taking highest precedence
  return {
    ...defaultConfig,
    ...userConfig,
    ...overrides,
    // Deep merge for nested objects
    server: {
      ...defaultConfig.server,
      ...(userConfig.server || {}),
      ...(overrides.server || {})
    },
    optimize: {
      ...defaultConfig.optimize,
      ...(userConfig.optimize || {}),
      ...(overrides.optimize || {})
    },
    resolve: {
      ...defaultConfig.resolve,
      ...(userConfig.resolve || {}),
      ...(overrides.resolve || {})
    },
    debug: {
      ...defaultConfig.debug,
      ...(userConfig.debug || {}),
      ...(overrides.debug || {})
    }
  };
}
