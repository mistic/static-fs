'use strict';

const resolve = require('path').resolve;
const { patchModuleLoader } = require('static-fs/dist/runtime');

const mockFs = {
  readFileSync: (path) => {
    if (path === `${resolve(__dirname, 'static_fs_mock', 'patched', 'path', 'file.js')}`) {
      return 'module.exports = 1';
    }
    throw new Error();
  },
  realpathSync: (path) => {
    return path;
  },
  statSync: (path) => {
    if (path === __dirname) {
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

    if (path === `${resolve(__dirname, 'static_fs_mock', 'patched', 'path', 'file.js')}`) {
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
require('./static_fs_mock/patched/path/file');
undo_module_loader_patch();
require('./static_fs_mock/patched/path/file');
