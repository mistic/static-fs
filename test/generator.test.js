import { resolve } from 'path';
import { createTestTempDir, getDirContent, getStaticFsPackage } from './helpers';

let staticFs = null,
  testTempDir = null,
  folderToAdd = null,
  mountRoot = null,
  entryPoint = null,
  filesAddedToStaticFs = [];

describe('Static Fs Generator', () => {
  beforeAll(async () => {
    testTempDir = await createTestTempDir();
    staticFs =  getStaticFsPackage(testTempDir);

    folderToAdd = resolve(testTempDir, 'node_modules');
    mountRoot = testTempDir;
    entryPoint = require.resolve(testTempDir);

    // generate the static fs
    filesAddedToStaticFs = await staticFs.generateStaticFsVolume(
      mountRoot,
      [
        folderToAdd
      ],
      [
        entryPoint
      ]
    );
  });

  test('create a valid static fs into the mounting root', async () => {

  });

  test('static fs bundle for the expected files (= all except .node)', async () => {
    const expectedFilesOnStaticFs = getDirContent(folderToAdd)
      .filter(fileName => !fileName.includes('.node'));

    expect(filesAddedToStaticFs.length).toEqual(expectedFilesOnStaticFs.length);
  });

  test('if the entry points were patched', async () => {

  });
});
