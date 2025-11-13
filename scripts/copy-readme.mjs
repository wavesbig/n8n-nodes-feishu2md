import { promises as fsp } from 'fs';
import path from 'path';

async function ensureDir(p) {
  try {
    await fsp.mkdir(p, { recursive: true });
  } catch {}
}

async function copyFileSafe(src, dest) {
  try {
    await fsp.copyFile(src, dest);
  } catch {}
}

async function copyDirSafe(srcDir, destDir) {
  try {
    const stat = await fsp.stat(srcDir);
    if (!stat.isDirectory()) return;
  } catch {
    return;
  }
  await ensureDir(destDir);
  const entries = await fsp.readdir(srcDir);
  for (const name of entries) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    try {
      const s = await fsp.stat(src);
      if (s.isDirectory()) {
        await copyDirSafe(src, dest);
      } else {
        await copyFileSafe(src, dest);
      }
    } catch {}
  }
}

async function main() {
  const root = process.cwd();
  const dist = path.join(root, 'dist');
  await ensureDir(dist);
  // Copy README.md to dist so npm displays it when publishing dist directory
  await copyFileSafe(path.join(root, 'README.md'), path.join(dist, 'README.md'));
  // Copy docs assets referenced by README
  await copyDirSafe(path.join(root, 'docs'), path.join(dist, 'docs'));
}

main().catch((err) => {
  console.error('[copy-readme] failed:', err);
  process.exit(1);
});