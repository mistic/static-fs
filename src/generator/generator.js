import { dirname, relative, resolve } from 'path';
import { WritableStaticVolume } from '../filesystem';
import { copyFile, isFile, readFile, writeFile, unixifyPath } from '../common';

// Creates a static-fs runtime file in the target
const createStaticFsRuntimeFile = async (outDir) => {
  const sourceFile = require.resolve(`../runtime`);
  const outFile = resolve(outDir, 'static_fs_runtime.js');
  await copyFile(sourceFile, outFile);

  return outFile;
};

// Patches target node app entry points in order
// to make the server code able to read files
// from the static fs
const patchEntryPoints = async (entryPoints, staticFSRuntimeFile, staticFsVolumeFile) => {
  for (const entryPoint of entryPoints) {
    const isEntryPointAFile = await isFile(entryPoint);

    if (isEntryPointAFile) {
      let loaderPath = relative(dirname(entryPoint), staticFSRuntimeFile).replace(/\\/g, '/');
      if (loaderPath.charAt(0) !== '.') {
        loaderPath = `./${loaderPath}`;
      }
      let fsPath = relative(dirname(entryPoint), staticFsVolumeFile).replace(/\\/g, '/');
      fsPath = `\${__dirname }/${fsPath}`;

      let content = await readFile(entryPoint, { encoding: 'utf8' });
      const patchLine = `require('${loaderPath}')\n.load(require.resolve(\`${fsPath}\`));\n`;
      let prefix = '';
      if (content.indexOf(patchLine) === -1) {
        const rx = /^#!.*$/gm.exec(content.toString());
        if (rx && rx.index === 0) {
          prefix = `${rx[0]}\n`;
          // remove prefix
          content = content.replace(prefix, '');
        }
        // strip existing loader
        content = content.replace(/^require.*static_fs_runtime.js.*$/gm, '');
        content = content.replace(/\/\/ load static_fs_volume: .*$/gm, '');
        content = content.trim();
        content = `${prefix}// load static_fs_volume: ${fsPath}\n${patchLine}\n${content}`;

        await writeFile(entryPoint, content);
      }
    }
  }
};

// adds file to the static filesystem volume
const addFolderToStaticFsVolume = async (mountRootDir, foldersToAdd, exclusions) => {
  const sfs = new WritableStaticVolume(mountRootDir);

  for (const folderToAdd of foldersToAdd) {
    await sfs.addFolder(folderToAdd, exclusions);
  }

  await sfs.write();

  // returning all the files and base folders added to that created volume
  return sfs.getAddedFilesAndFolders();
};

export const generateStaticFsVolume = async (mountRootDir, foldersToAdd, appEntryPointsToPatch, exclusions = []) => {
  const sanitizedMountRootDir = resolve(mountRootDir);
  const sanitizedOutputDir = resolve(sanitizedMountRootDir, 'static_fs');
  const sanitizedFoldersToAdd = foldersToAdd.map((p) => resolve(p));
  const sanitizedAppEntryPointsToPatch = appEntryPointsToPatch.map((p) => resolve(p));
  const sanitizedExclusions = exclusions.reduce((accum, val) => {
    const resolvedVal = unixifyPath(resolve(val));
    if (!resolvedVal.includes(sanitizedMountRootDir)) {
      throw new Error(`All exclusions should has mountRoot has parent: ${sanitizedMountRootDir}`);
    }
    accum[resolvedVal] = true;
    return accum;
  }, {});

  const filesAddedToVolume = await addFolderToStaticFsVolume(
    sanitizedMountRootDir,
    sanitizedFoldersToAdd,
    sanitizedExclusions,
  );
  const staticFSRuntimeFile = await createStaticFsRuntimeFile(sanitizedOutputDir);
  await patchEntryPoints(
    sanitizedAppEntryPointsToPatch,
    staticFSRuntimeFile,
    resolve(sanitizedOutputDir, 'static_fs_volume.sfsv'),
    sanitizedMountRootDir,
  );

  return filesAddedToVolume;
};
