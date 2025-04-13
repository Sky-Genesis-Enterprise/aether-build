// Aether HMR Client (simplified dist version)
// This is a simplified version of the full HMR client
// In a real implementation, this would be the compiled version of client.ts

(function() {
  // HMR Runtime state
  const hotModulesMap = new Map();
  const pruneMap = new Map();
  let socket = null;
  let isConnected = false;

  // Expose HMR API to window (for debugging)
  window.__AETHER_HMR__ = {
    hotModulesMap,
    pruneMap,
    socket,
    isConnected
  };

  // Create WebSocket connection for HMR
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
        const payload = JSON.parse(data);
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

  // Handle HMR messages
  async function handleMessage(payload) {
    switch (payload.type) {
      case 'update':
        if (payload.modules && payload.modules.length > 0) {
          console.log(`[aether] Module update: ${payload.modules.join(', ')}`);
          await updateModules(payload.modules, payload.timestamp || Date.now());
        }
        break;

      case 'reload':
        console.log('[aether] Full page reload');
        location.reload();
        break;

      default:
        break;
    }
  }

  // Update modules via HMR
  async function updateModules(modules, timestamp) {
    for (const path of modules) {
      const hotModule = hotModulesMap.get(path);
      if (!hotModule) continue;

      const callbacks = hotModule.callbacks;
      if (callbacks.length > 0) {
        try {
          const url = `${path}?t=${timestamp}`;
          const newModule = await import(url);

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

  // Create HMR context for a module
  function createHotContext(ownerPath) {
    if (!hotModulesMap.has(ownerPath)) {
      hotModulesMap.set(ownerPath, {
        id: ownerPath,
        callbacks: []
      });
    }

    return {
      accept(callback) {
        if (callback) {
          hotModulesMap.get(ownerPath).callbacks.push(callback);
        }
      },

      acceptDeps(deps, callback) {
        if (callback) {
          hotModulesMap.get(ownerPath).callbacks.push(callback);
        }
      },

      decline() {
        hotModulesMap.delete(ownerPath);
      },

      invalidate() {
        location.reload();
      },

      dispose(callback) {
        if (callback) {
          pruneMap.set(ownerPath, callback);
        }
      },

      data: {}
    };
  }

  // Initialize client
  createWebSocket();

  // Expose HMR context creator
  window.__AETHER_CREATE_HOT__ = createHotContext;

  console.log('[aether] HMR client initialized');
})();
