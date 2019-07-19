'use strict';

const fs = require('fs');
const { patchFilesystem } = require('static-fs/dist/runtime');

const mockFs = {
  readFileSync: (path) => {
    if (path === './static_fs_mock/patched/path/file.js') {
      return 'module.exports = 1';
    }
    throw new Error();
  }
};

const undo_filesystem_patch = patchFilesystem(mockFs, fs);
fs.readFileSync('./static_fs_mock/patched/path/file.js');
undo_filesystem_patch();
console.log(fs.readFileSync('./static_fs_mock/patched/path/file.js'));
