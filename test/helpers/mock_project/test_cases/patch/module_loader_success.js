'use strict';

const { resolve } = require('path');
const { patchModuleLoader } = require('static-fs/dist/runtime');
const { unixifyPath } = require('static-fs/dist/common');

const mockFs = {
  readFileSync: (path) => {
    if (unixifyPath(path) === unixifyPath(resolve('./static_fs_mock/patched/path/file.js'))) {
      return 'module.exports = 1';
    }
    throw new Error();
  },
  realpathSync: (path) => {
    return unixifyPath((path));
  },
  statSync: (path) => {
    if (unixifyPath(path) === unixifyPath(resolve('.'))) {
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

    if (unixifyPath(path) === unixifyPath(resolve('./static_fs_mock/patched/path/file.js'))) {
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

const mockStaticFsRuntime = {
  staticfilesystem: mockFs
};

const undo_module_loader_patch = patchModuleLoader(mockStaticFsRuntime);
const staticFsPatchedPathFileExport = require('./static_fs_mock/patched/path/file');
console.log(staticFsPatchedPathFileExport);
undo_module_loader_patch();
