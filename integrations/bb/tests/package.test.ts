import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repository } from './helpers';
import { experimental_scanPublicSdkOnly } from '@get-bb/plugin-sdk/testing';
import manifest from '../package.json';
import { hostContract } from '../contract';
import { ACCEPTED_VERSIONS } from '../host/process';

describe('package boundaries', () => {
  it('uses public SDK imports and no private bb packages', async () => {
    const result = await experimental_scanPublicSdkOnly(
      fileURLToPath(new URL('..', import.meta.url)),
      {
        allow: [
          /^(semver|tar-stream|yauzl)$/,
          /^vitest(?:\/config)?$/,
          /^(react(?:-dom)?(?:\/.*)?|@testing-library\/react|@radix-ui\/react-slot|class-variance-authority|clsx|tailwind-merge)$/,
        ],
      },
    );
    expect(result.violations).toEqual([]);
    expect(result.privateDependencies).toEqual([]);
  });
  it('declares only implemented entries, no agent skills and the current version range', () => {
    expect(manifest.bb.skills).toEqual([]);
    expect(manifest.bb.app).toBe('./app.tsx');
    const [major, minor] = manifest.version.split('.').map(Number);
    expect(ACCEPTED_VERSIONS).toBe(`>=${major}.${minor}.0 <${major}.${minor + 1}.0`);
    const cargoVersion = /^version = "([^"]+)"/m.exec(
      readFileSync(join(repository, 'Cargo.toml'), 'utf8'),
    )?.[1];
    expect(manifest.version).toBe(cargoVersion);
    expect(hostContract.status.experimental_retryable).toBe(true);
    expect(hostContract.openAnalysis).not.toHaveProperty('experimental_retryable');
  });
});
