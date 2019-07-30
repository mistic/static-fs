import { readdirSync, statSync } from 'fs';
import { dirname, sep } from 'path';

export function getDirContent(path) {
  const foldersWithNativeModulesIdx = {};
  const foldersIdx = {};
  const contentFilesWithoutNativeModules = _getDirContent(path, foldersWithNativeModulesIdx, foldersIdx, path);

  return contentFilesWithoutNativeModules
    .concat(Object.keys(foldersIdx).filter(folderPath => !foldersWithNativeModulesIdx[folderPath]));
}

function _addParentsForFolder(folderPath, baseRoot, accum) {
  const parent = dirname(folderPath);
  if (parent && parent !== baseRoot && parent.includes(baseRoot)) {
    accum[parent] = true;
    return _addParentsForFolder(parent, baseRoot, accum);
  }
}

function _getDirContent(path, foldersWithNativeModulesIdx, foldersIdx, baseRoot, result = []) {
  for (const each of readdirSync(path)) {
    if (statSync(`${path}${sep}${each}`).isDirectory()) {
      const newPath = `${path}${sep}${each}`;

      if (newPath !== baseRoot && newPath.includes(baseRoot)) {
        foldersIdx[newPath] = true;
      }
      _getDirContent(newPath, foldersWithNativeModulesIdx, foldersIdx, baseRoot, result);
    } else {
      const file = `${path}${sep}${each}`;
      const isNativeModuleFile = file.includes('.node');

      if (isNativeModuleFile && !foldersWithNativeModulesIdx[path]) {
        foldersWithNativeModulesIdx[path] = true;
        _addParentsForFolder(path, baseRoot, foldersWithNativeModulesIdx);
      }

      if(!isNativeModuleFile) {
        _addParentsForFolder(path, baseRoot, foldersIdx);
        result.push(`${path}${sep}${each}`);
      }
    }
  }

  return result;
}
