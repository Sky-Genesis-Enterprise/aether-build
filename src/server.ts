import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve, extname } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import { fileExists, readFile, getExtension } from './utils/file.js';
import { AetherConfig } from './config.js';
import { type Plugin } from './plugins.js';
import { createHMRPlugin, getSerializedHMRClientCode } from './hmr/runtime.js';

// File extension to MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.ts': 'application/javascript', // TS will be transformed
  '.tsx': 'application/javascript', // TSX will be transformed
  '.jsx': 'application/javascript', // JSX will be transformed
  '.map': 'application/json'
};

// HMR payload types for improved typechecking
interface HMRPayload {
  type: 'update' | 'reload' | 'error' | 'prune';
  path?: string;
  timestamp?: number;
  modules?: string[];
  message?: string;
  stack?: string;
}

interface DevServerOptions {
  config: AetherConfig;
  plugins: Plugin[];
}

export class DevServer {
  private config: AetherConfig;
  private plugins: Plugin[];
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private hmrPlugin: Plugin;
  private moduleGraph = new Map<string, Set<string>>();

  constructor(options: DevServerOptions) {
    this.config = options.config;

    // Add HMR plugin first if we're in dev mode
    this.hmrPlugin = createHMRPlugin();
    this.plugins = [this.hmrPlugin, ...options.plugins];

    this.clients = new Set();

    // Create HTTP server
    this.httpServer = createServer(this.handleRequest.bind(this));

    // Create WebSocket server for HMR
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (socket) => {
      this.clients.add(socket);

      socket.on('close', () => {
        this.clients.delete(socket);
      });
    });

    // Handle WebSocket upgrade
    this.httpServer.on('upgrade', (request, socket, head) => {
      if (request.url === '/__aether_hmr') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });
  }

  /**
   * Start the development server
   */
  async start(): Promise<void> {
    const { port = 3000, host = 'localhost', watch } = this.config.server || {};

    // Configure plugins
    for (const plugin of this.plugins) {
      if (plugin.configureDevServer) {
        await plugin.configureDevServer({
          config: this.config,
          port,
          host
        });
      }
    }

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.listen(port, host as string, () => {
        console.log(`Dev server running at http://${host}:${port}/`);
        resolve();
      });
    });

    // Start file watcher
    if (watch) {
      this.startWatcher(Array.isArray(watch) ? watch : [watch]);
    }
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // Special HMR client endpoint
    if (pathname === '/__aether_hmr_client') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      try {
        const hmrClientCode = getSerializedHMRClientCode();
        res.end(hmrClientCode);
      } catch (err) {
        console.error('Error serving HMR client:', err);
        res.end('console.error("Failed to load HMR client");');
      }
      return;
    }

    // Determine the file path
    let filePath = pathname;

    // If URL ends with '/', serve index.html
    if (filePath.endsWith('/')) {
      filePath += 'index.html';
    }

    // Convert URL path to file path
    filePath = resolve(process.cwd(), filePath.slice(1));

    // Check if file exists
    if (!fileExists(filePath)) {
      // If file doesn't exist, try to send index.html (SPA support)
      const indexPath = join(process.cwd(), 'index.html');

      if (getExtension(pathname) === '' && fileExists(indexPath)) {
        filePath = indexPath;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
    }

    try {
      // Read file content
      const content = readFile(filePath);

      // Determine content type
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Transform content if needed
      let finalContent = content;

      // For HTML files, inject HMR client script
      if (contentType === 'text/html') {
        finalContent = content.replace(
          '</head>',
          `<script type="module" src="/__aether_hmr_client"></script></head>`
        );
      }

      // Transform TypeScript/JSX if needed
      if (['.ts', '.tsx', '.jsx'].includes(ext)) {
        for (const plugin of this.plugins) {
          if (plugin.transform) {
            const result = await plugin.transform({
              config: this.config,
              filePath,
              content,
              code: finalContent,
              map: undefined
            });

            if (result) {
              finalContent = typeof result === 'string' ? result : result.code;
            }
          }
        }
      }

      // Send response
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(finalContent);
    } catch (error) {
      console.error(`Error serving ${filePath}:`, error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }

  /**
   * Start file watcher for HMR
   */
  private startWatcher(patterns: string[]): void {
    this.watcher = chokidar.watch(patterns, {
      ignored: [/node_modules/, /\.git/],
      persistent: true
    });

    this.watcher.on('change', async (path: string) => {
      console.log(`File changed: ${path}`);

      // Determine affected modules
      const timestamp = Date.now();
      const affectedModules = this.getAffectedModules(path);

      // Notify plugins
      for (const plugin of this.plugins) {
        if (plugin.watchChange) {
          await plugin.watchChange(path, { event: 'update' });
        }

        if (plugin.handleHotUpdate) {
          await plugin.handleHotUpdate({
            file: path,
            server: this
          });
        }
      }

      // Determine if we can use HMR or need a full reload
      const hmrAccepted = this.hasAcceptedUpdate(path);

      // Notify clients
      if (hmrAccepted) {
        this.notifyClients({
          type: 'update',
          path,
          modules: [path, ...affectedModules],
          timestamp
        });
      } else {
        // Full page reload
        this.notifyClients({
          type: 'reload'
        });
      }
    });
  }

  /**
   * Get a list of modules affected by a change to the given file
   */
  private getAffectedModules(path: string): string[] {
    // In a real implementation, this would use the module graph
    // to determine exactly which modules depend on the changed file
    // For now we'll return an empty array, meaning only the changed file itself is affected
    console.log(`Calculating affected modules for: ${path}`);
    return [];
  }

  /**
   * Check if a module or its dependents accept HMR updates
   */
  private hasAcceptedUpdate(path: string): boolean {
    // In a real implementation, this would check the accept handlers
    // For now, assume all JavaScript/TypeScript modules accept updates
    return /\.(js|mjs|ts|jsx|tsx)$/.test(path);
  }

  /**
   * Send message to all connected clients
   */
  notifyClients(data: HMRPayload): void {
    const message = JSON.stringify(data);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Update the module graph
   */
  updateModuleGraph(importer: string, imported: string[]): void {
    if (!this.moduleGraph.has(importer)) {
      this.moduleGraph.set(importer, new Set());
    }

    for (const dep of imported) {
      this.moduleGraph.get(importer)!.add(dep);
    }
  }

  /**
   * Stop the server and watcher
   */
  async close(): Promise<void> {
    // Close file watcher
    if (this.watcher) {
      await this.watcher.close();
    }

    // Close WebSocket server
    this.wss.close();

    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * Create and start a development server
 */
export async function createDevServer(config: AetherConfig): Promise<DevServer> {
  const plugins = config.plugins || [];
  const server = new DevServer({
    config,
    plugins: Array.isArray(plugins) ? plugins : []
  });

  await server.start();
  return server;
}
