import del from 'del';
import { existsSync, readFileSync } from 'fs';
import { resolve, sep } from 'path';
import { getDirContent, getStaticFsPackage } from './helpers';

const testTempDir = global.__mock_project_path,
  staticFs = getStaticFsPackage(testTempDir),
  folderToAdd = resolve(testTempDir, 'node_modules'),
  mountRoot = testTempDir,
  entryPoint = resolve(testTempDir, 'test_cases/full_app_usage.js'),
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

  afterAll(async () => {
    const filesOnStaticFsExceptStaticFs = filesAddedToStaticFs.filter(filePath => !filePath.includes(`node_modules${sep}static-fs`));
    await del(filesOnStaticFsExceptStaticFs, { force: true });
  });

  test('create a valid static fs into the mounting root', async () => {
    const baseSFSFolder = resolve(mountRoot, 'static_fs');
    const existsBaseSFSFolder = existsSync(baseSFSFolder);
    const sfsBaseFolderFiles = getDirContent(baseSFSFolder);
    const expectedFilesOnBaseSFSFolder = [
      resolve(baseSFSFolder, 'static_fs_volume.sfsv'),
      resolve(baseSFSFolder, 'static_fs_runtime.js')
    ];

    expect(existsBaseSFSFolder).toBeTruthy();
    expect(sfsBaseFolderFiles.length).toBe(2);
    expect(sfsBaseFolderFiles).toEqual(expect.arrayContaining(expectedFilesOnBaseSFSFolder));
  });

  test('static fs bundle for the expected files (= all except .node)', async () => {
    const expectedFilesOnStaticFs = getDirContent(folderToAdd)
      .filter(fileName => !fileName.includes('.node'));

    expect(filesAddedToStaticFs.length).toEqual(expectedFilesOnStaticFs.length);
  });

  test('if the entry points were patched', async () => {
    const entryPointContent = readFileSync(entryPoint, { encoding: 'utf8' }).toString();

    expect(entryPointContent.includes('// load static_fs_volume:')).toBeTruthy();
  });
});
