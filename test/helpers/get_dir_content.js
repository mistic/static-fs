import { readdirSync, statSync } from 'fs';
import { dirname, resolve, sep } from 'path';

export function getDirContent(path, exclusions = []) {
  const foldersWithNativeModulesIdx = {};
  const foldersIdx = {};
  const sanitizedExclusions = exclusions.reduce((accum, val) => {
    const resolvedVal = resolve(val);
    accum[resolvedVal] = true;
    return accum;
  }, {});
  const contentFilesWithoutNativeModules = _getDirContent(path, foldersWithNativeModulesIdx, foldersIdx, path, sanitizedExclusions);

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

function _getDirContent(path, foldersWithNativeModulesIdx, foldersIdx, baseRoot, exclusions, result = []) {
  for (const each of readdirSync(path)) {
    // is declared exclusion?
    const foundExclusion = exclusions[path] || exclusions[`${path}${sep}${each}`];
    if (foundExclusion) {
      continue;
    }

    if (statSync(`${path}${sep}${each}`).isDirectory()) {
      const newPath = `${path}${sep}${each}`;

      if (newPath !== baseRoot && newPath.includes(baseRoot)) {
        foldersIdx[newPath] = true;
      }
      _getDirContent(newPath, foldersWithNativeModulesIdx, foldersIdx, baseRoot, exclusions, result);
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
