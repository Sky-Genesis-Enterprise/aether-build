import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastGlob from 'fast-glob';

/**
 * Get the current directory of the calling file
 */
export function getDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}

/**
 * Resolve a path relative to the current directory
 */
export function resolvePath(importMetaUrl: string, ...paths: string[]): string {
  return resolve(getDirname(importMetaUrl), ...paths);
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Read a file as text
 */
export function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

/**
 * Write text to a file, creating directories if they don't exist
 */
export function writeFile(path: string, content: string): void {
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, content);
}

/**
 * Find files matching a glob pattern
 */
export function findFiles(pattern: string | string[], options?: fastGlob.Options): string[] {
  return fastGlob.sync(pattern, options);
}

/**
 * Get project root directory (where package.json is located)
 */
export function findProjectRoot(startPath: string = process.cwd()): string {
  let currentPath = resolve(startPath);

  while (!existsSync(join(currentPath, 'package.json'))) {
    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      throw new Error('Could not find project root (no package.json found in any parent directory)');
    }
    currentPath = parentPath;
  }

  return currentPath;
}

/**
 * Get the extension of a file, including the dot
 */
export function getExtension(filePath: string): string {
  const match = /(\.[^./\\]+)$/.exec(filePath);
  return match ? match[1] : '';
}

/**
 * Determine if a file is a module (ESM, TypeScript, etc.)
 */
export function isModuleFile(filePath: string): boolean {
  const ext = getExtension(filePath).toLowerCase();
  return ['.js', '.mjs', '.ts', '.tsx', '.jsx'].includes(ext);
}
