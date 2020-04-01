'use strict';

const { patchModuleLoader } = require('static-fs/dist/runtime');
const { sanitizePath } = require('../../utils');

const mockFs = {
  readFileSync: (path) => {
    if (sanitizePath(path) === sanitizePath('./static_fs_mock/patched/path/file.js')) {
      return 'module.exports = 1';
    }
    throw new Error();
  },
  realpathSync: (path) => {
    return sanitizePath(path);
  },
  statSync: (path) => {
    if (sanitizePath(path) === sanitizePath('.')) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
      };
    }

    if (sanitizePath(path) === sanitizePath('./static_fs_mock/patched/path/file.js')) {
      return {
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
      };
    }
    throw new Error();
  },
};

const mockStaticFsRuntime = {
  staticfilesystem: mockFs,
};

const undo_module_loader_patch = patchModuleLoader(mockStaticFsRuntime);
const staticFsPatchedPathFileExport = require('./static_fs_mock/patched/path/file');
console.log(staticFsPatchedPathFileExport);
undo_module_loader_patch();
