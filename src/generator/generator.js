import { dirname, relative, resolve } from 'path';
import { WritableStaticVolume } from '../filesystem'
import { copyFile, isFile, mkdir, readFile, writeFile } from '../common';

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
const patchEntryPoints = async (entryPoints, staticFSRuntimeFile, staticFsVolumeFile, projectRootDir) => {
  for (const entryPoint of entryPoints) {
    const isEntryPointAFile = await isFile(entryPoint);

    if (isEntryPointAFile) {
      let loaderPath = relative(dirname(entryPoint), staticFSRuntimeFile).replace(/\\/g, '/');
      if (loaderPath.charAt(0) !== '.') {
        loaderPath = `./${loaderPath}`;
      }
      let fsPath = relative(dirname(entryPoint), staticFsVolumeFile).replace(/\\/g, '/');
      fsPath = `\${__dirname }/${fsPath}`;
      const projectRelativeRootDir = `\${__dirname }/${relative(dirname(entryPoint), projectRootDir)}`;
      let content = await readFile(entryPoint, { encoding: 'utf8' });
      const patchLine = `require('${loaderPath}')\n.load(require.resolve(\`${fsPath}\`), \`${projectRelativeRootDir}\`);\n`;
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
        content = content.replace(/\/\/ load static-fs volume file:: .*$/gm, '');
        content = content.trim();
        content = `${prefix}// load static-fs volume file:: ${fsPath}\n${patchLine}\n${content}`;

        await writeFile(entryPoint, content);
      }
    }
  }
};

// adds file to the static filesystem volume
const addFolderToStaticFsVolume = async (projectRootDir, outputDir, staticVolumeName, foldersToAdd) => {
  const sfs = new WritableStaticVolume(projectRootDir);

  for (const folderToAdd of foldersToAdd) {
    await sfs.addFolder(folderToAdd);
  }

  await mkdir(outputDir);
  await sfs.write(resolve(outputDir, staticVolumeName));
};

export const generateStaticFsVolume = async (projectRootDir, outputDir, staticVolumeName, foldersToAdd, appEntryPointsToPatch) => {
  const sanitizedProjectRootDir = resolve(projectRootDir);
  const sanitizedOutputDir = resolve(sanitizedProjectRootDir, outputDir);
  const sanitizedFoldersToAdd = foldersToAdd.map(p => resolve(p));
  const sanitizedAppEntryPointsToPatch = appEntryPointsToPatch.map(p => resolve(p));

  await addFolderToStaticFsVolume(sanitizedProjectRootDir, sanitizedOutputDir, staticVolumeName, sanitizedFoldersToAdd);
  const staticFSRuntimeFile  = await createStaticFsRuntimeFile(sanitizedOutputDir);
  await patchEntryPoints(sanitizedAppEntryPointsToPatch, staticFSRuntimeFile, resolve(sanitizedOutputDir, staticVolumeName), sanitizedProjectRootDir);
};
