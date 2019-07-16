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

patchFilesystem(mockFs);

const staticFsPatchedPathFileExport = fs.readFileSync('./static_fs_mock/patched/path/file.js');
console.log(staticFsPatchedPathFileExport);
