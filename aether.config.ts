import { definePlugin, type AetherConfig } from './src/index.js';

/**
 * Sample custom plugin
 */
const reactPlugin = definePlugin({
  name: 'aether:react',
  configResolved(config) {
    console.log('React plugin initialized');
  },
  transform(ctx) {
    const { filePath, code } = ctx;
    // Real implementation would handle React-specific transformations
    // This is just a placeholder
    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
      return code; // Return original code for now
    }
    return null;
  }
});

/**
 * Sample Aether Build configuration
 */
const config: AetherConfig = {
  // Project metadata
  name: 'aether-sample',

  // Build options
  entry: './src/index.ts',
  outDir: './dist',

  // Development server options
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    watch: ['src/**/*']
  },

  // Build optimizations
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true,
    splitting: true,
    treeshake: true
  },

  // Plugin system - TypeScript plugin is added by default in CLI
  plugins: [
    reactPlugin
  ],

  // Aliases for import resolution
  alias: {
    '@': './src'
  },

  // File resolution options
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default']
  }
};

export default config;
