# Aether Build

A modern, fast developer build tool for the Aether ecosystem, inspired by Vite but built from scratch to be more modular and plugin-friendly.

## Features

- **Fast**: Built with speed in mind, using modern JavaScript tooling
- **Plugin-friendly**: Extensible via a powerful plugin system
- **TypeScript First**: First-class support for TypeScript, JSX, and TSX
- **Framework Agnostic**: Works with any framework, with easy React integration
- **Modern ESM**: Uses ES modules for better performance and tree-shaking
- **Development Server**: Built-in dev server with hot module replacement
- **Simple CLI**: Clean command-line interface for common tasks

## Installation

```bash
# Using npm
npm install -g aether-build

# Using yarn
yarn global add aether-build

# Using bun
bun install -g aether-build
```

## Usage

### Command-Line Interface

```bash
# Start development server
aether dev

# Build for production
aether build

# Serve production build
aether serve

# Create a new project
aether create my-app --template react
```

### Configuration

Create an `aether.config.ts` file in your project root:

```typescript
import { definePlugin, type AetherConfig } from 'aether-build';

const config: AetherConfig = {
  entry: './src/index.ts',
  outDir: './dist',
  server: {
    port: 3000,
    host: 'localhost',
    open: true
  },
  optimize: {
    minify: true,
    target: 'es2022',
    sourcemap: true
  },
  // Add custom plugins
  plugins: [
    // Your plugins here
  ]
};

export default config;
```

### API Usage

```typescript
import { createAether } from 'aether-build';

async function main() {
  const aether = await createAether({
    entry: './src/index.ts',
    outDir: './dist'
  });

  // Start dev server
  const server = await aether.createDevServer();

  // Or build for production
  await aether.build();
}

main().catch(console.error);
```

### Creating Plugins

```typescript
import { definePlugin } from 'aether-build';

const myPlugin = definePlugin({
  name: 'my-plugin',

  // Lifecycle hooks
  configResolved(config) {
    console.log('Config resolved', config);
  },

  transform(ctx) {
    const { filePath, code } = ctx;

    // Only transform specific files
    if (filePath.endsWith('.special.js')) {
      return `/* Transformed by my-plugin */\n${code}`;
    }

    return null; // Skip transformation
  }
});

// Use in config
export default {
  // ...
  plugins: [myPlugin]
};
```

## Plugin API

Aether Build provides a rich plugin API with lifecycle hooks for various stages of the build process:

- **Configuration**: `configResolved`, `configureServer`
- **Build**: `buildStart`, `transform`, `resolveId`, `load`, `buildEnd`
- **Dev Server**: `configureDevServer`, `handleHotUpdate`
- **Misc**: `watchChange`, `closeBundle`

## License

MIT