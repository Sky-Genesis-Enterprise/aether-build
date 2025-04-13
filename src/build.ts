import { join, relative, dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { fileExists, readFile, writeFile } from './utils/file.js';
import { type AetherConfig } from './config.js';
import { type Plugin, applyPluginHook, loadPlugins } from './plugins.js';
import { processDependencies, type DependencyInfo } from './utils/dependency.js';

/**
 * Build context shared across the build process
 */
interface BuilderContext {
  config: AetherConfig;
  plugins: Plugin[];
  entryPoints: string[];
  outputs: Map<string, { code: string; map?: object }>;
  processed: Set<string>;
  dependencies: Map<string, Set<string>>;
  moduleGraph: Map<string, DependencyInfo[]>;
}

/**
 * Convert entry point configuration to a list of file paths
 */
async function resolveEntryPoints(config: AetherConfig): Promise<string[]> {
  const { entry } = config;

  if (typeof entry === 'string') {
    // Single entry point as string
    return [resolve(process.cwd(), entry)];
  } else if (Array.isArray(entry)) {
    // Multiple entry points as array
    return entry.map(e => resolve(process.cwd(), e));
  } else if (typeof entry === 'object') {
    // Entry points as object with names
    return Object.values(entry).map(e => resolve(process.cwd(), e));
  }

  throw new Error('Invalid entry point configuration');
}

/**
 * Create a builder context based on the config
 */
async function createBuilderContext(config: AetherConfig): Promise<BuilderContext> {
  const plugins = config.plugins ? await loadPlugins(config.plugins) : [];
  const entryPoints = await resolveEntryPoints(config);

  return {
    config,
    plugins,
    entryPoints,
    outputs: new Map(),
    processed: new Set(),
    dependencies: new Map(),
    moduleGraph: new Map()
  };
}

/**
 * Process a file during the build
 */
async function processFile(
  ctx: BuilderContext,
  filePath: string,
  importedBy?: string
): Promise<void> {
  // Skip if already processed
  if (ctx.processed.has(filePath)) {
    // Just update dependencies if needed
    if (importedBy) {
      const deps = ctx.dependencies.get(importedBy) || new Set();
      deps.add(filePath);
      ctx.dependencies.set(importedBy, deps);
    }
    return;
  }

  // Mark as processed to avoid circular imports
  ctx.processed.add(filePath);

  // Create a dependency set for this file
  if (importedBy) {
    const deps = ctx.dependencies.get(importedBy) || new Set();
    deps.add(filePath);
    ctx.dependencies.set(importedBy, deps);
  }

  // Read file content
  const content = fileExists(filePath) ? readFile(filePath) : '';

  // Skip empty files
  if (!content) {
    console.warn(`Empty or missing file: ${filePath}`);
    return;
  }

  // Run transform hooks
  let code = content;
  let map: object | undefined = undefined;

  // Apply transforms from plugins
  for (const plugin of ctx.plugins) {
    if (plugin.transform) {
      try {
        const result = await plugin.transform({
          config: ctx.config,
          filePath,
          content,
          code,
          map
        });

        if (result) {
          if (typeof result === 'string') {
            code = result;
          } else {
            code = result.code;
            map = result.map || map;
          }
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name} transforming ${filePath}:`, error);
        throw error;
      }
    }
  }

  // Store output
  ctx.outputs.set(filePath, { code, map });

  // Process dependencies recursively
  const dependencies = await processDependencies(filePath, code, ctx.config, ctx.plugins);

  // Store in module graph
  ctx.moduleGraph.set(filePath, dependencies);

  // Process each resolved dependency
  for (const dep of dependencies) {
    if (dep.resolved && !dep.isExternal) {
      await processFile(ctx, dep.resolved, filePath);
    }
  }
}

/**
 * Write build outputs to the file system
 */
async function writeOutputs(ctx: BuilderContext): Promise<void> {
  const { outDir } = ctx.config;
  const outDirPath = resolve(process.cwd(), outDir);

  // Ensure output directory exists
  if (!existsSync(outDirPath)) {
    mkdirSync(outDirPath, { recursive: true });
  }

  for (const [filePath, { code, map }] of ctx.outputs.entries()) {
    // Determine output path
    const relPath = relative(process.cwd(), filePath);
    const outputPath = join(outDirPath, relPath);

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Replace extension for compiled files
    let finalPath = outputPath;
    if (finalPath.endsWith('.ts') || finalPath.endsWith('.tsx')) {
      finalPath = finalPath.replace(/\.tsx?$/, '.js');
    }

    // Write code
    writeFile(finalPath, code);

    // Write sourcemap if exists
    if (map && ctx.config.optimize?.sourcemap) {
      const mapPath = `${finalPath}.map`;
      writeFile(mapPath, JSON.stringify(map));

      // Add sourcemap comment if not already added
      if (!code.includes('//# sourceMappingURL=')) {
        const appendedCode = `${code}\n//# sourceMappingURL=${relative(dirname(finalPath), mapPath)}`;
        writeFile(finalPath, appendedCode);
      }
    }
  }
}

/**
 * Generate a dependency graph visualization for debugging
 */
function generateDependencyGraph(ctx: BuilderContext): string {
  let graph = 'Dependency Graph:\n';

  for (const [module, deps] of ctx.moduleGraph.entries()) {
    graph += `\n${module}:\n`;

    for (const dep of deps) {
      const status = dep.isExternal ? '(external)' : dep.resolved ? '(resolved)' : '(unresolved)';
      graph += `  └─ ${dep.id} ${status}\n`;
    }
  }

  return graph;
}

/**
 * Main build function
 */
export async function build(config: AetherConfig): Promise<void> {
  console.log('Starting build...');
  const startTime = performance.now();

  // Create builder context
  const ctx = await createBuilderContext(config);

  // Run buildStart hooks
  await applyPluginHook(ctx.plugins, 'buildStart', { config });

  // Process all entry points
  for (const entryPoint of ctx.entryPoints) {
    await processFile(ctx, entryPoint);
  }

  // Log dependency graph if in verbose mode
  if (config.debug?.verbose) {
    console.log(generateDependencyGraph(ctx));
  }

  // Run buildEnd hooks
  await applyPluginHook(ctx.plugins, 'buildEnd', {
    config,
    outputs: ctx.outputs
  });

  // Write outputs to disk
  await writeOutputs(ctx);

  // Log completion
  const duration = Math.round(performance.now() - startTime);
  console.log(`Build completed in ${duration}ms`);
  console.log(`Processed ${ctx.processed.size} files`);
  console.log(`Output directory: ${resolve(process.cwd(), config.outDir)}`);

  // Run closeBundle hooks
  for (const plugin of ctx.plugins) {
    if (plugin.closeBundle) {
      await plugin.closeBundle();
    }
  }
}

/**
 * Bundle a set of files based on the configuration
 */
export async function bundle(config: AetherConfig): Promise<void> {
  try {
    await build(config);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}
