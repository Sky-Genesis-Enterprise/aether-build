#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { resolveConfig } from './config.js';
import { build } from './build.js';
import { createDevServer } from './server.js';
import { typescriptPlugin } from './plugins/index.js';
import scaffold from './scaffold/index.js';

// Get package info for version
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkg = require(join(__dirname, '..', 'package.json'));

// Determine CLI name (aether or apm)
const cliName = process.argv[1]?.includes('apm') ? 'apm' : 'aether';

// Create root command
const program = new Command()
  .name(cliName)
  .description('Aether Build - Modern Web Development Build Tool')
  .version(pkg.version);

/**
 * Handle errors consistently
 */
function handleError(error: unknown): void {
  console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/**
 * Default plugins that are always loaded
 */
function getDefaultPlugins() {
  return [
    typescriptPlugin()
  ];
}

// Dev command
program
  .command('dev')
  .description('Start development server')
  .option('-c, --config <path>', 'Path to config file')
  .option('-p, --port <port>', 'Port to listen on', (v) => parseInt(v, 10))
  .option('-h, --host <host>', 'Host to listen on')
  .option('-o, --open', 'Open browser automatically')
  .action(async (options) => {
    try {
      console.log(pc.green('🚀 Starting Aether development server...'));

      const config = await resolveConfig(options.config, {
        server: {
          port: options.port,
          host: options.host,
          open: options.open
        },
        plugins: getDefaultPlugins()
      });

      await createDevServer(config);

      console.log(pc.green('✅ Dev server running'));
      console.log(pc.dim(`Press ${pc.bold('Ctrl+C')} to stop`));
    } catch (error) {
      handleError(error);
    }
  });

// Build command
program
  .command('build')
  .description('Build for production')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-minify', 'Disable minification')
  .option('--target <target>', 'Target environment (es2018, es2020, es2022, esnext)')
  .option('--outDir <path>', 'Output directory')
  .action(async (options) => {
    try {
      console.log(pc.green('📦 Building for production...'));

      const config = await resolveConfig(options.config, {
        optimize: {
          minify: options.minify !== false,
          target: options.target as any
        },
        outDir: options.outDir || undefined,
        plugins: getDefaultPlugins()
      });

      await build(config);

      console.log(pc.green('✅ Build complete'));
    } catch (error) {
      handleError(error);
    }
  });

// Serve command
program
  .command('serve')
  .description('Serve production build')
  .option('-c, --config <path>', 'Path to config file')
  .option('-p, --port <port>', 'Port to listen on', (v) => parseInt(v, 10))
  .option('-h, --host <host>', 'Host to listen on')
  .option('-d, --dir <path>', 'Directory to serve (defaults to dist)')
  .action(async (options) => {
    try {
      console.log(pc.green('🚀 Starting Aether production server...'));

      const config = await resolveConfig(options.config, {
        server: {
          port: options.port,
          host: options.host
        },
        outDir: options.dir || 'dist'
      });

      await createDevServer(config);

      console.log(pc.green('✅ Server running'));
      console.log(pc.dim(`Serving ${pc.bold(config.outDir)}`));
      console.log(pc.dim(`Press ${pc.bold('Ctrl+C')} to stop`));
    } catch (error) {
      handleError(error);
    }
  });

// Create command - for scaffolding new projects
program
  .command('create [projectName]')
  .description('Create a new project')
  .option('-t, --template <template>', 'Template to use (vanilla, react, vue)', 'vanilla')
  .option('--ts', 'Use TypeScript (default)', true)
  .option('--js', 'Use JavaScript instead of TypeScript')
  .option('-pm, --package-manager <manager>', 'Package manager to use (npm, yarn, pnpm, bun)', 'npm')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip installing dependencies')
  .option('-d, --description <description>', 'Project description')
  .option('-a, --author <author>', 'Project author')
  .option('-v, --version <version>', 'Project version')
  .action(async (projectName, options) => {
    try {
      if (!projectName) {
        console.log(pc.yellow('Please provide a project name:'));
        console.log(`  ${pc.cyan(cliName)} create ${pc.bold('my-app')}`);
        console.log(`\nAvailable templates: ${scaffold.getAvailableTemplates().join(', ')}`);
        return;
      }

      const useTs = options.js ? false : true;

      console.log(pc.green(`🚀 Creating new ${projectName ? `'${projectName}'` : 'project'} with ${pc.bold(options.template)} template (${useTs ? 'TypeScript' : 'JavaScript'})...`));

      await scaffold.createProject({
        projectName,
        templateName: options.template,
        typescript: useTs,
        packageManager: options.packageManager,
        installDeps: options.install,
        git: options.git,
        description: options.description,
        author: options.author,
        version: options.version
      });

    } catch (error) {
      handleError(error);
    }
  });

// Plugin command - for managing plugins
program
  .command('plugin <action>')
  .description('Manage plugins (add, remove, list)')
  .action(async (action) => {
    try {
      console.log(pc.green(`🔌 ${action} plugins...`));
      console.log(pc.yellow('This feature is not yet implemented.'));

      // In a real implementation, we would handle plugin management here

    } catch (error) {
      handleError(error);
    }
  });

// Execute the program
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
