import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { deleteFiles, getDirContent, getStaticFsPackage } from './helpers';

const testTempDir = global.__mock_project_path,
  staticFs = getStaticFsPackage(testTempDir),
  folderToAdd = resolve(testTempDir, 'node_modules'),
  extraFolderToAdd = resolve(testTempDir, 'extra_simple_folder'),
  mountRoot = testTempDir,
  entryPoint = resolve(testTempDir, 'test_cases/full_app_usage.js'),
  exceptions = [
    resolve(testTempDir, 'node_modules', 'static-fs'),
    resolve(testTempDir, 'node_modules', 'mock_simple_module_non_bundled')
  ],
  filesAddedToStaticFs = [];

describe('Static Fs Generator', () => {
  beforeAll(async () => {
    // generate the static fs
    filesAddedToStaticFs.push(
      ...(
        await staticFs.generateStaticFsVolume(
          mountRoot,
          [
            folderToAdd,
            extraFolderToAdd
          ],
          [
            entryPoint
          ],
          exceptions
        )
      )
    );
  });

  afterAll(async () => {
    await deleteFiles(filesAddedToStaticFs);
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
    const expectedFilesOnStaticFs = getDirContent(folderToAdd, exceptions);
    expectedFilesOnStaticFs.push(
      getDirContent(extraFolderToAdd),
      extraFolderToAdd
    );

    expect(filesAddedToStaticFs.length).toEqual(expectedFilesOnStaticFs.length);
  });

  test('if list of added files has paths in the correct order', async () => {
    const orderedFilesAddedList = [...filesAddedToStaticFs].sort((a, b) => b.localeCompare(a));

    expect(filesAddedToStaticFs).toEqual(orderedFilesAddedList);
  });

  test('if the entry points were patched', async () => {
    const entryPointContent = readFileSync(entryPoint, { encoding: 'utf8' }).toString();

    expect(entryPointContent.includes('// load static_fs_volume:')).toBeTruthy();
  });
});
