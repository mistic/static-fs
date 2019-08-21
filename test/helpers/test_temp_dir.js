import cpy from 'cpy';
import { mkdtemp, realpathSync } from 'fs';
import os from 'os';
import { join, resolve } from 'path';
import rimraf from 'rimraf';
import { promisify } from 'util';

const mkdtempAsync = promisify(mkdtemp);
const rimRafAsync = promisify(rimraf);

export async function createTestTempDir() {
  try {
    const createdTempTestDir = await mkdtempAsync(join(realpathSync(os.tmpdir()), 'static-fs-test-'));
    // copy mock_project into it
    await cpy('./**/*', createdTempTestDir, {
      cwd: resolve('test/helpers/mock_project'),
      parents: true
    });

    return createdTempTestDir;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function removeTestTempDirs() {
  await rimRafAsync('/static-fs-test-*', { glob: { root: os.tmpdir() } });
}
