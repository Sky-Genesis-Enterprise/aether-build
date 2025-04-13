// Export public API
import { resolveConfig, type AetherConfig } from './config.js';
import { build, bundle } from './build.js';
import { DevServer, createDevServer } from './server.js';
import {
  type Plugin,
  type BuildContext,
  type BuildStartContext,
  type BuildEndContext,
  type DevServerContext,
  type ResolveContext,
  definePlugin,
  loadPlugins,
  applyPluginHook,
  typescriptPlugin
} from './plugins.js';
import {
  fileExists,
  readFile,
  writeFile,
  findFiles,
  getDirname,
  resolvePath,
  findProjectRoot,
  getExtension,
  isModuleFile
} from './utils/file.js';
import {
  extractImports,
  resolveModuleSpecifier,
  processDependencies,
  type DependencyInfo
} from './utils/dependency.js';

// Import framework plugins
import {
  reactPlugin,
  vuePlugin,
  type ReactPluginOptions,
  type VuePluginOptions
} from './plugins/index.js';

// Re-export all public APIs
export {
  // Config
  resolveConfig,
  type AetherConfig,

  // Build system
  build,
  bundle,

  // Server
  DevServer,
  createDevServer,

  // Plugin system
  type Plugin,
  type BuildContext,
  type BuildStartContext,
  type BuildEndContext,
  type DevServerContext,
  type ResolveContext,
  definePlugin,
  loadPlugins,
  applyPluginHook,
  typescriptPlugin,

  // Framework plugins
  reactPlugin,
  vuePlugin,
  type ReactPluginOptions,
  type VuePluginOptions,

  // Utils
  fileExists,
  readFile,
  writeFile,
  findFiles,
  getDirname,
  resolvePath,
  findProjectRoot,
  getExtension,
  isModuleFile,

  // Dependency utils
  extractImports,
  resolveModuleSpecifier,
  processDependencies,
  type DependencyInfo
};

/**
 * Create a new Aether Build instance with the given configuration
 */
export async function createAether(config: AetherConfig) {
  const finalConfig = await resolveConfig(null, config);

  return {
    config: finalConfig,
    build: () => build(finalConfig),
    createDevServer: () => createDevServer(finalConfig)
  };
}
