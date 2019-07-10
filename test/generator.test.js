import { resolve } from 'path';
import { getDirContent, getStaticFsPackage } from './helpers';

const testTempDir = global.__mock_project_path,
  staticFs = getStaticFsPackage(testTempDir),
  folderToAdd = resolve(testTempDir, 'node_modules'),
  mountRoot = testTempDir,
  entryPoint = require.resolve(testTempDir),
  filesAddedToStaticFs = [];

describe('Static Fs Generator', () => {
  beforeAll(async () => {
    // generate the static fs
    filesAddedToStaticFs.push(
      ...(
        await staticFs.generateStaticFsVolume(
          mountRoot,
          [
            folderToAdd
          ],
          [
            entryPoint
          ]
        )
      )
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
