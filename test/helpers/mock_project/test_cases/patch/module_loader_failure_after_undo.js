'use strict';

const { patchFilesystem, patchModuleLoader } = require('static-fs/dist/runtime');
const { sanitizePath } = require('../../utils');

const mockFs = {
  readFileSync: (path) => {
    if (path === sanitizePath('./static_fs_mock/patched/path/file.js')) {
      return 'module.exports = 1';
    }
    throw new Error();
  },
  realpathSync: (path) => {
    return path;
  },
  statSync: (path) => {
    if (path === sanitizePath('.')) {
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

    if (path === sanitizePath('./static_fs_mock/patched/path/file.js')) {
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

const undo_filesystem_patch = patchFilesystem(mockStaticFsRuntime);
const undo_module_loader_patch = patchModuleLoader(mockStaticFsRuntime);
require('./static_fs_mock/patched/path/file');
undo_module_loader_patch();
require('./static_fs_mock/patched/path/file');
undo_filesystem_patch();
