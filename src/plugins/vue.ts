import { type Plugin, type BuildContext } from '../plugins.js';

export interface VuePluginOptions {
  /**
   * Template options for Vue compiler
   */
  templateOptions?: Record<string, unknown>;

  /**
   * Whether to enable HMR for Vue components
   */
  hmr?: boolean;

  /**
   * Whether to support TypeScript in Vue components
   */
  typescript?: boolean;

  /**
   * Whether to include CSS in the JavaScript bundle
   */
  cssInJs?: boolean;

  /**
   * Additional esbuild options
   */
  esbuildOptions?: Record<string, unknown>;
}

/**
 * Create a plugin for Vue single-file components
 */
export function vuePlugin(options: VuePluginOptions = {}): Plugin {
  // Default options
  const {
    hmr = true,
    typescript = true,
    cssInJs = true,
    esbuildOptions = {}
  } = options;

  return {
    name: 'aether:vue',

    configResolved() {
      console.log('Vue plugin initialized with', JSON.stringify({
        hmr,
        typescript,
        cssInJs
      }, null, 2));
    },

    async resolveId(ctx) {
      const { source, importer } = ctx;

      // Handle direct .vue imports
      if (source.endsWith('.vue') && importer) {
        // In a full implementation, we would handle this more robustly
        return null; // Let default resolver handle it for now
      }

      return null;
    },

    async transform(ctx: BuildContext) {
      const { filePath, code, config } = ctx;

      // Only transform .vue files
      if (!filePath.endsWith('.vue')) {
        return null;
      }

      try {
        // In a real implementation, we would use @vue/compiler-sfc
        // Since we can't have all dependencies, we'll stub the functionality

        // Extract the different parts of the SFC
        const { template, script, styles } = parseVueSFC(code);

        // Process the script section
        let scriptContent = script || 'export default {}';

        // Handle TypeScript if enabled
        if (typescript && scriptContent.includes('lang="ts"')) {
          const { transform } = await import('esbuild');
          const result = await transform(extractScriptContent(scriptContent), {
            loader: 'ts',
            target: config.optimize?.target || 'es2022',
            sourcemap: true,
            ...esbuildOptions
          });
          scriptContent = result.code;
        } else {
          scriptContent = extractScriptContent(scriptContent);
        }

        // In a real implementation, we would compile the template
        let templateCode = '';
        if (template) {
          templateCode = `
const render = function(_ctx, _cache) {
  // This is a placeholder for the real Vue template compiler
  // In a real implementation, the template would be compiled to render functions
  return h('div', 'Compiled Vue template would go here');
};
`;
        }

        // Handle CSS
        let cssCode = '';
        if (styles && styles.length > 0 && cssInJs) {
          const combinedCss = styles.map(style => extractStyleContent(style)).join('\n');

          cssCode = `
// Add component styles
(function() {
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(combinedCss)};
  document.head.appendChild(style);
})();
`;
        }

        // Construct the final component code
        const finalCode = `
import { h, defineComponent } from 'vue';
${scriptContent}

// Add template render function
${templateCode}

// Add component options
const _sfc_main = _exports.default || _exports;
_sfc_main.render = render;

${cssCode}

// Add HMR support
${hmr && config.server ? addVueHmrCode(filePath) : ''}

export default _sfc_main;
`;

        return {
          code: finalCode,
          map: undefined // In a real implementation, we would provide source maps
        };
      } catch (error) {
        console.error(`Error transforming Vue component ${filePath}:`, error);
        return null;
      }
    }
  };
}

/**
 * Simple Vue SFC parser
 * In a real implementation, we would use @vue/compiler-sfc
 */
function parseVueSFC(code: string): { template?: string; script?: string; styles: string[] } {
  const templateMatch = /<template>([\s\S]*?)<\/template>/i.exec(code);
  const scriptMatch = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/i.exec(code);
  const styleMatches = code.match(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi) || [];

  return {
    template: templateMatch ? templateMatch[1] : undefined,
    script: scriptMatch ? scriptMatch[0] : undefined,
    styles: styleMatches
  };
}

/**
 * Extract script content from script tag
 */
function extractScriptContent(script: string): string {
  const match = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/i.exec(script);
  return match ? match[2].trim() : '';
}

/**
 * Extract style content from style tag
 */
function extractStyleContent(style: string): string {
  const match = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/i.exec(style);
  return match ? match[2].trim() : '';
}

/**
 * Add Hot Module Replacement support for Vue components
 */
function addVueHmrCode(filePath: string): string {
  return `
// [Aether] Vue HMR
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      // Replace the component in the component registry
      // In a real implementation, this would use the Vue HMR API
      console.log('[Aether] Hot updated: ${filePath}');
    }
  });
}
`;
}
