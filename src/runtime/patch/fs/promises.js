import { promisify } from 'util';

function patchFn(patchedFs, fn) {
  return (...args) => {
    return fn(patchedFs, ...args);
  };
}

function open(patchedFs, path, flag, modes) {
  return promisify(patchedFs.open)(path, flag, modes);
}

function readdir(patchedFs, path, options) {
  return promisify(patchedFs.readdir)(path, options);
}

function readFile(patchedFs, path, options) {
  return promisify(patchedFs.readFile)(path, options);
}

function realpath(patchedFs, path, options) {
  return promisify(patchedFs.realpath)(path, options);
}

function stat(patchedFs, path, options) {
  return promisify(patchedFs.stat)(path, options);
}

export function createPatchedFsPromises(patchedFs) {
  return {
    open: patchFn(patchedFs, open),
    readdir: patchFn(patchedFs, readdir),
    readFile: patchFn(patchedFs, readFile),
    realpath: patchFn(patchedFs, realpath),
    stat: patchFn(patchedFs, stat),
  };
}
