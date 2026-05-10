import { afterEach, describe, expect, test } from '@jest/globals';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { prepareExternalCamoufoxExecutable } from '../../lib/camoufox-executable.js';

const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'camofox-executable-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  rmSync(join(tmpdir(), 'camofox-browser-external-camoufox'), { recursive: true, force: true });
});

describe('prepareExternalCamoufoxExecutable', () => {
  test('creates camoufox-js compatibility links for an external bundle', () => {
    const bundleDir = makeTempDir();
    const cacheDir = makeTempDir();
    const executable = join(bundleDir, 'camoufox-bin');

    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    writeFileSync(join(bundleDir, 'properties.json'), '[]\n');
    writeFileSync(join(bundleDir, 'version.json'), '{"version":"135.0.1","release":"beta.24"}\n');
    mkdirSync(join(bundleDir, 'fontconfig', 'lin'), { recursive: true });

    const prepared = prepareExternalCamoufoxExecutable(executable, { cacheDir });

    expect(prepared.resourceDir).toBe(bundleDir);
    expect(prepared.executablePath).toContain('camofox-browser-external-camoufox');
    expect(existsSync(prepared.executablePath)).toBe(true);
    expect(existsSync(join(cacheDir, 'version.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'fontconfig'))).toBe(true);
    expect(existsSync(join(cacheDir, 'properties.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'camoufox-bin'))).toBe(true);
  });

  test('accepts Nix-style external bundle without fontconfig', () => {
    const bundleDir = makeTempDir();
    const cacheDir = makeTempDir();
    const executable = join(bundleDir, 'camoufox-bin');

    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    writeFileSync(join(bundleDir, 'properties.json'), '[]\n');
    writeFileSync(join(bundleDir, 'version.json'), '{"version":"135.0.1","release":"beta.24"}\n');

    const prepared = prepareExternalCamoufoxExecutable(executable, { cacheDir });

    expect(prepared.resourceDir).toBe(bundleDir);
    expect(existsSync(join(cacheDir, 'fontconfig'))).toBe(false);
    expect(existsSync(join(cacheDir, 'version.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'properties.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'camoufox-bin'))).toBe(true);
  });

  test('refreshes camoufox-js cache when executable changes', () => {
    const cacheDir = makeTempDir();
    const bundleA = makeTempDir();
    const bundleB = makeTempDir();

    for (const [bundleDir, version] of [[bundleA, '135.0.1'], [bundleB, '136.0.1']]) {
      const executable = join(bundleDir, 'camoufox-bin');
      writeFileSync(executable, `#!/bin/sh\necho ${version}\n`);
      chmodSync(executable, 0o755);
      writeFileSync(join(bundleDir, 'properties.json'), `[{"version":"${version}"}]\n`);
      writeFileSync(join(bundleDir, 'version.json'), `{"version":"${version}","release":"beta.24"}\n`);
      mkdirSync(join(bundleDir, 'fontconfig', 'lin'), { recursive: true });
    }

    const executableA = join(bundleA, 'camoufox-bin');
    const executableB = join(bundleB, 'camoufox-bin');

    prepareExternalCamoufoxExecutable(executableA, { cacheDir });
    expect(realpathSync(join(cacheDir, 'camoufox-bin'))).toBe(realpathSync(executableA));

    prepareExternalCamoufoxExecutable(executableB, { cacheDir });
    expect(realpathSync(join(cacheDir, 'camoufox-bin'))).toBe(realpathSync(executableB));
    expect(realpathSync(join(cacheDir, 'properties.json'))).toBe(realpathSync(join(bundleB, 'properties.json')));
    expect(realpathSync(join(cacheDir, 'version.json'))).toBe(realpathSync(join(bundleB, 'version.json')));
  });

  test('fails clearly when bundle resources are missing', () => {
    const bundleDir = makeTempDir();
    const executable = join(bundleDir, 'camoufox-bin');
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);

    expect(() => prepareExternalCamoufoxExecutable(executable, { cacheDir: makeTempDir() }))
      .toThrow(/properties\.json/);
  });
});
