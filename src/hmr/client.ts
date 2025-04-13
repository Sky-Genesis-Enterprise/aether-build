/**
 * Aether Build HMR Client
 * This is injected into the page during development
 */

interface HMRPayload {
  type: 'update' | 'reload' | 'error' | 'prune';
  path?: string;
  acceptedPath?: string;
  timestamp?: number;
  modules?: string[];
  moduleGraph?: Record<string, string[]>;
  message?: string;
  stack?: string;
}

interface HMRModule {
  id: string;
  callbacks: HMRCallback[];
}

type HMRCallback = (data: any) => void;

// HMR Runtime state
const hotModulesMap = new Map<string, HMRModule>();
const pruneMap = new Map<string, (data: any) => void | Promise<void>>();
let socket: WebSocket | null = null;
let isConnected = false;
let currentScriptPath: string | null = null;

// Extend the global window object
declare global {
  interface Window {
    __AETHER_HMR__: {
      hotModulesMap: Map<string, HMRModule>;
      pruneMap: Map<string, (data: any) => void | Promise<void>>;
      socket: WebSocket | null;
      isConnected: boolean;
      currentScriptPath: string | null;
    };
  }
  interface ImportMeta {
    hot?: {
      accept: (callback?: HMRCallback) => void;
      acceptDeps: (deps: string[], callback: HMRCallback) => void;
      decline: () => void;
      invalidate: (message?: string) => void;
      dispose: (callback: (data: any) => void) => void;
      prune: (callback: (data: any) => void) => void;
      data: any;
    };
  }
}

// Expose HMR API to window (for debugging)
window.__AETHER_HMR__ = {
  hotModulesMap,
  pruneMap,
  socket,
  isConnected,
  currentScriptPath,
};

/**
 * Create the WebSocket connection for HMR
 */
function createWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${protocol}//${location.host}/__aether_hmr`;

  socket = new WebSocket(socketUrl);
  socket.addEventListener('open', () => {
    isConnected = true;
    console.log('[aether] HMR client connected');
  });

  socket.addEventListener('message', async ({ data }) => {
    try {
      const payload: HMRPayload = JSON.parse(data);
      handleMessage(payload);
    } catch (err) {
      console.error('[aether] Error parsing HMR message:', err);
    }
  });

  socket.addEventListener('close', () => {
    isConnected = false;
    console.log('[aether] HMR connection lost. Trying to reconnect...');
    setTimeout(createWebSocket, 1000);
  });

  socket.addEventListener('error', (err) => {
    console.error('[aether] HMR connection error:', err);
  });
}

/**
 * Handle incoming HMR messages
 */
async function handleMessage(payload: HMRPayload) {
  switch (payload.type) {
    case 'update':
      // Module update - no need to reload the page
      if (payload.modules && payload.modules.length > 0) {
        console.log(`[aether] Module update: ${payload.modules.join(', ')}`);
        await updateModules(payload.modules, payload.timestamp || Date.now());
      }
      break;

    case 'reload':
      // Full page reload
      console.log('[aether] Full page reload');
      location.reload();
      break;

    case 'error':
      // Error in HMR update
      console.error(`[aether] HMR error: ${payload.message}\n${payload.stack}`);
      break;

    case 'prune':
      // Module pruning
      if (payload.path) {
        console.log(`[aether] Pruning module: ${payload.path}`);
        pruneModule(payload.path);
      }
      break;
  }
}

/**
 * Update modules via HMR
 */
async function updateModules(modules: string[], timestamp: number) {
  // For each changed module, we need to reload it
  for (const path of modules) {
    const hotModule = hotModulesMap.get(path);
    if (!hotModule) continue;

    const callbacks = hotModule.callbacks;
    if (callbacks.length > 0) {
      try {
        // Create a URL with cache-busting
        const url = `${path}?t=${timestamp}`;
        // Import the module dynamically
        const newModule = await import(url);

        // Call all update callbacks
        for (const callback of callbacks) {
          await Promise.resolve(callback(newModule));
        }
        console.log(`[aether] Hot updated: ${path}`);
      } catch (e) {
        console.error(`[aether] Failed to hot update: ${path}`, e);
        window.location.reload();
      }
    }
  }
}

/**
 * Clean up a module during pruning
 */
function pruneModule(path: string) {
  const dispose = pruneMap.get(path);
  if (dispose) {
    try {
      const data = {};
      dispose(data);
      pruneMap.delete(path);
    } catch (err) {
      console.error(`[aether] Error while pruning ${path}:`, err);
    }
  }

  hotModulesMap.delete(path);
}

/**
 * Initialize HMR in the current module
 */
function createHotContext(ownerPath: string) {
  if (!hotModulesMap.has(ownerPath)) {
    hotModulesMap.set(ownerPath, {
      id: ownerPath,
      callbacks: []
    });
  }

  // The context object exposed to import.meta.hot
  return {
    accept(callback?: HMRCallback) {
      if (callback) {
        hotModulesMap.get(ownerPath)!.callbacks.push(callback);
      }
    },

    acceptDeps(deps: string[], callback: HMRCallback) {
      // In a real implementation, would track specific dependencies
      // For simplicity, we accept the whole module
      if (callback) {
        hotModulesMap.get(ownerPath)!.callbacks.push(callback);
      }
    },

    decline() {
      // Mark this module as not hot-updatable
      hotModulesMap.delete(ownerPath);
    },

    invalidate(message = '') {
      location.reload();
    },

    dispose(callback: (data: any) => void) {
      if (callback) {
        pruneMap.set(ownerPath, callback);
      }
    },

    prune(callback: (data: any) => void) {
      // Alias to dispose
      if (callback) {
        pruneMap.set(ownerPath, callback);
      }
    },

    // Custom data that persists across updates
    data: {}
  };
}

/**
 * Initialize the HMR client
 */
function initialize() {
  createWebSocket();

  // Create global helper to expose hot context to modules
  (window as any).__AETHER_CREATE_HOT__ = createHotContext;

  console.log('[aether] HMR client initialized');
}

// Auto-initialize
initialize();
