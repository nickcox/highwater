import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { BinaryProvisioner, pinnedRelease } from '../host/provision';
import { HighwaterProcess } from '../host/process';
import { ACCEPTED_VERSIONS } from '../host/process';
import { tempDirectory, writePi } from './helpers';

const directories: string[] = [];
const processes: HighwaterProcess[] = [];
afterEach(async () => {
  for (const process of processes.splice(0)) await process.dispose();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

it.each(Object.keys(pinnedRelease.platforms))(
  'downloads, verifies and safely extracts the published %s archive',
  async (platform) => {
    const home = await tempDirectory();
    directories.push(home);
    const [os, arch] = platform.split('-');
    const provisioner = new BinaryProvisioner(home, ACCEPTED_VERSIONS, { platform: os, arch });
    const binary = await provisioner.get(new AbortController().signal);
    expect((await readFile(binary)).length).toBe(
      pinnedRelease.platforms[platform as keyof typeof pinnedRelease.platforms].binaryBytes,
    );
    expect(await readFile(join(binary, '..', 'LICENSE'), 'utf8')).toContain('MIT License');
    expect(await provisioner.get(new AbortController().signal)).toBe(binary);
  },
);

it('starts the published native binary with no Highwater on PATH, then reuses it offline', async () => {
  const home = await tempDirectory();
  directories.push(home);
  await writePi(home);
  const options = { dataDir: join(home, 'data'), home, env: { PATH: join(home, 'no-tools') } };
  const first = new HighwaterProcess(options);
  processes.push(first);
  const server = await first.get(null);
  expect(server.version).toBe(pinnedRelease.version);
  const response = await fetch(server.baseUrl + '/api/sessions');
  expect(response.status).toBe(200);
  await first.dispose();
  const cached = new HighwaterProcess({
    ...options,
    provisioning: {
      fetcher: async () => {
        throw new Error('Offline acceptance check');
      },
    },
  });
  processes.push(cached);
  expect((await cached.get(null)).version).toBe(pinnedRelease.version);
});
