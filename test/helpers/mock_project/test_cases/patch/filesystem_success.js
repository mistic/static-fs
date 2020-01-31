'use strict';

const fs = require('fs');
const { patchFilesystem } = require('static-fs/dist/runtime');

const mockFs = {
  statSync: (path) => {
    if (path === './static_fs_mock/patched/path/file.js') {
      return true;
    }
  },
  readFileSync: (path) => {
    if (path === './static_fs_mock/patched/path/file.js') {
      return 'module.exports = 1';
    }
    throw new Error();
  }
};

const mockStaticFsRuntime = {
  staticfilesystem: mockFs
};

const undo_filesystem_patch = patchFilesystem(mockStaticFsRuntime);
const staticFsPatchedPathFileExport = fs.readFileSync('./static_fs_mock/patched/path/file.js');
console.log(staticFsPatchedPathFileExport);
undo_filesystem_patch();
