'use strict';

const posixPath = require('path').posix;
const { patchModuleLoader } = require('static-fs/dist/runtime');

const mockFs = {
  readFileSync: (path) => {
    if (path === `${posixPath.resolve('./static_fs_mock/patched/path/file.js')}`) {
      return 'module.exports = 1';
    }
    throw new Error();
  },
  realpathSync: (path) => {
    return path;
  },
  statSync: (path) => {
    if (path === posixPath.resolve('.')) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false
      }
    }

    if (path === `${posixPath.resolve('./static_fs_mock/patched/path/file.js')}`) {
      return {
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false
      }
    }
    throw new Error();
  }
};

const undo_module_loader_patch = patchModuleLoader(mockFs, true);
const staticFsPatchedPathFileExport = require('./static_fs_mock/patched/path/file');
console.log(staticFsPatchedPathFileExport);
undo_module_loader_patch();
