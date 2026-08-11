import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { watch } from 'chokidar';
import { config } from '../config/app-config.js';
import { logger } from '../utils/logger.js';

const cache = new Map<string, string>();
let watcher: ReturnType<typeof watch> | null = null;

export function initTemplateWatcher(): void {
  if (watcher) return;

  watcher = watch(config.templatesDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on('change', (filePath: string) => {
    const rel = relative(config.templatesDir, filePath);
    cache.delete(rel);
    logger.info(`Template reloaded: ${rel}`);
  });

  watcher.on('unlink', (filePath: string) => {
    const rel = relative(config.templatesDir, filePath);
    cache.delete(rel);
  });

  logger.info(`Watching templates in ${config.templatesDir}`);
}

export function loadTemplate(filePath: string): string {
  if (cache.has(filePath)) {
    return cache.get(filePath)!;
  }

  const fullPath = join(config.templatesDir, filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Template not found: ${filePath}`);
  }

  const content = readFileSync(fullPath, 'utf-8');
  cache.set(filePath, content);
  return content;
}

export function listTemplates(dir = ''): string[] {
  const fullDir = join(config.templatesDir, dir);
  if (!existsSync(fullDir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(fullDir)) {
    const entryPath = join(fullDir, entry);
    const relPath = dir ? `${dir}/${entry}` : entry;
    if (statSync(entryPath).isDirectory()) {
      files.push(...listTemplates(relPath));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

export function getTemplateContent(filePath: string): string | null {
  const fullPath = join(config.templatesDir, filePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

export function saveTemplate(filePath: string, content: string): void {
  const fullPath = join(config.templatesDir, filePath);
  writeFileSync(fullPath, content, 'utf-8');
  cache.delete(filePath);
}

export function deleteTemplate(filePath: string): boolean {
  const fullPath = join(config.templatesDir, filePath);
  if (!existsSync(fullPath)) return false;
  unlinkSync(fullPath);
  cache.delete(filePath);
  return true;
}
