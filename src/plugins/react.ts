import { type Plugin, type BuildContext } from '../plugins.js';

export interface ReactPluginOptions {
  /**
   * JSX factory to use (default: 'React.createElement')
   */
  jsxFactory?: string;

  /**
   * JSX fragment factory to use (default: 'React.Fragment')
   */
  jsxFragment?: string;

  /**
   * Use the new JSX transform from React 17+ (default: true)
   */
  jsxImportSource?: string | boolean;

  /**
   * Whether to optimize react components (default: true)
   */
  optimize?: boolean;

  /**
   * Whether to inject fast refresh support for React (default: true in dev mode)
   */
  fastRefresh?: boolean;

  /**
   * Additional options for esbuild
   */
  esbuildOptions?: Record<string, unknown>;
}

/**
 * Create a plugin for React JSX support
 */
export function reactPlugin(options: ReactPluginOptions = {}): Plugin {
  // Default options
  const {
    jsxFactory = 'React.createElement',
    jsxFragment = 'React.Fragment',
    jsxImportSource = 'react',
    optimize = true,
    fastRefresh,
    esbuildOptions = {}
  } = options;

  return {
    name: 'aether:react',

    configResolved(config) {
      console.log('React plugin initialized with', JSON.stringify({
        jsxFactory,
        jsxFragment,
        jsxImportSource,
        optimize,
        fastRefresh: fastRefresh ?? config.server !== undefined, // Enable in dev mode by default
      }, null, 2));
    },

    async transform(ctx: BuildContext) {
      const { filePath, code, config } = ctx;

      // Only transform JSX files
      if (!(/\.(jsx|tsx)$/.test(filePath))) {
        return null;
      }

      try {
        const { transform } = await import('esbuild');

        // Check if we should use the new JSX transform from React 17+
        const useNewJSXTransform = jsxImportSource !== false;
        const isJsxDev = config.server !== undefined; // Dev mode

        // Apply automatic JSX runtime for React 17+
        let result;

        if (useNewJSXTransform) {
          result = await transform(code, {
            loader: filePath.endsWith('.tsx') ? 'tsx' : 'jsx',
            jsx: 'automatic',
            jsxImportSource: typeof jsxImportSource === 'string' ? jsxImportSource : 'react',
            target: config.optimize?.target || 'es2022',
            sourcemap: true,
            ...esbuildOptions
          });
        } else {
          // Classic JSX transform
          result = await transform(code, {
            loader: filePath.endsWith('.tsx') ? 'tsx' : 'jsx',
            jsx: 'transform',
            jsxFactory,
            jsxFragment,
            target: config.optimize?.target || 'es2022',
            sourcemap: true,
            ...esbuildOptions
          });
        }

        // Add React refresh support in development mode if requested
        let transformedCode = result.code;

        if (fastRefresh && isJsxDev) {
          transformedCode = injectReactRefresh(transformedCode, filePath);
        }

        return {
          code: transformedCode,
          map: JSON.parse(result.map || '{}')
        };
      } catch (error) {
        console.error(`Error transforming React component ${filePath}:`, error);
        return null;
      }
    }
  };
}

/**
 * Inject React Fast Refresh support
 * This is a simplified version - a real implementation would be more robust
 */
function injectReactRefresh(code: string, filePath: string): string {
  const componentName = getComponentName(filePath);

  // Don't inject in non-component files
  if (!componentName) {
    return code;
  }

  const refreshCode = `
// [Aether] React Fast Refresh
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      __AETHER_REFRESH_COMPONENTS__["${componentName}"] = newModule.default || newModule;
      window.__AETHER_RELOAD_REACT__();
    }
  });
}
`;

  // Inject the refresh code
  return `${code}\n${refreshCode}`;
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath: string): string | null {
  const match = filePath.match(/([^/\\]+)\.(jsx|tsx)$/);
  if (!match) return null;

  const fileName = match[1];
  // Assume PascalCase file names are components
  if (fileName[0] === fileName[0].toUpperCase()) {
    return fileName;
  }
  return null;
}
