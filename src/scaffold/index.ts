/**
 * Project scaffolding functionality
 */

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { templates, type Template, type TemplateOptions } from './templates.js';
import pc from 'picocolors';

/**
 * Options for creating a new project
 */
export interface CreateProjectOptions {
  projectName: string;
  templateName: string;
  typescript: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  installDeps?: boolean;
  git?: boolean;
  description?: string;
  author?: string;
  version?: string;
}

/**
 * Get available templates
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(templates);
}

/**
 * Create a new project from a template
 */
export async function createProject(options: CreateProjectOptions): Promise<void> {
  const {
    projectName,
    templateName,
    typescript,
    packageManager = 'npm',
    installDeps = true,
    git = true,
    description = `A modern web project built with Aether Build`,
    author = '',
    version = '0.1.0'
  } = options;

  // Validate project name
  validateProjectName(projectName);

  // Get template
  const template = getTemplate(templateName, typescript);

  if (!template) {
    throw new Error(`Template "${templateName}" not found.`);
  }

  // Create project directory
  const projectDir = path.resolve(process.cwd(), projectName);
  createDirectory(projectDir);

  console.log(`\n${pc.green('✓')} Creating project in ${pc.bold(projectDir)}`);

  // Prepare template options
  const templateOptions: TemplateOptions = {
    projectName,
    typescript,
    description,
    author,
    version
  };

  // Create files from template
  await createFilesFromTemplate(template, projectDir, templateOptions);

  // Initialize git repository
  if (git) {
    initGitRepo(projectDir);
  }

  // Install dependencies
  if (installDeps) {
    installDependencies(projectDir, template, packageManager);
  }

  // Show success message
  console.log(`\n${pc.green('✓')} Project ${pc.bold(projectName)} created successfully!`);
  console.log(`\n  ${pc.bold('Next steps:')}`);
  console.log(`\n  ${pc.cyan('cd')} ${projectName}`);

  if (!installDeps) {
    console.log(`  ${pc.cyan(packageManager + (packageManager === 'yarn' ? '' : ' install'))}`);
  }

  console.log(`  ${pc.cyan(packageManager + (packageManager === 'npm' ? ' run' : ''))} dev\n`);
}

/**
 * Validate project name
 */
function validateProjectName(name: string): void {
  if (!name) {
    throw new Error('Project name is required');
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Project name can only contain lowercase letters, numbers, and hyphens');
  }

  if (fs.existsSync(path.resolve(process.cwd(), name))) {
    throw new Error(`Directory "${name}" already exists`);
  }
}

/**
 * Get a template based on name and typescript preference
 */
function getTemplate(templateName: string, typescript: boolean): Template | null {
  // If typescript is true and we have a TypeScript version, use that
  if (typescript && templates[templateName + '-ts']) {
    return templates[templateName + '-ts'];
  }

  // Otherwise fallback to the regular template
  return templates[templateName] || null;
}

/**
 * Create a directory
 */
function createDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create files from template
 */
async function createFilesFromTemplate(
  template: Template,
  projectDir: string,
  options: TemplateOptions
): Promise<void> {
  // Create files
  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(projectDir, filePath);

    // Create directory if needed
    createDirectory(path.dirname(fullPath));

    // Get content
    const fileContent = typeof content === 'function' ? content(options) : content;

    // Write file
    fs.writeFileSync(fullPath, fileContent);
    console.log(`${pc.green('✓')} Created ${pc.dim(filePath)}`);
  }
}

/**
 * Initialize a git repository
 */
function initGitRepo(projectDir: string): void {
  try {
    console.log(`\n${pc.blue('i')} Initializing git repository...`);
    execSync('git init', { cwd: projectDir, stdio: 'ignore' });
    execSync('git add .', { cwd: projectDir, stdio: 'ignore' });
    console.log(`${pc.green('✓')} Git repository initialized`);
  } catch (error) {
    console.warn(`${pc.yellow('!')} Failed to initialize git repository`);
  }
}

/**
 * Install dependencies
 */
function installDependencies(
  projectDir: string,
  template: Template,
  packageManager: string
): void {
  // Construct commands based on package manager
  const installCmd = packageManager === 'yarn' ? 'add' : 'install';
  const devFlag = packageManager === 'yarn' ? '--dev' : '--save-dev';

  try {
    console.log(`\n${pc.blue('i')} Installing dependencies...`);

    // Install dependencies
    if (template.dependencies.length > 0) {
      const depsCommand = `${packageManager} ${installCmd} ${template.dependencies.join(' ')}`;
      execSync(depsCommand, { cwd: projectDir, stdio: 'ignore' });
    }

    // Install dev dependencies
    if (template.devDependencies.length > 0) {
      const devDepsCommand = `${packageManager} ${installCmd} ${devFlag} ${template.devDependencies.join(' ')}`;
      execSync(devDepsCommand, { cwd: projectDir, stdio: 'ignore' });
    }

    console.log(`${pc.green('✓')} Dependencies installed`);
  } catch (error) {
    console.warn(`${pc.yellow('!')} Failed to install dependencies`);
    console.warn(`${pc.yellow('!')} Please run 'npm install' or 'yarn' manually`);
  }
}

export default {
  createProject,
  getAvailableTemplates
};
