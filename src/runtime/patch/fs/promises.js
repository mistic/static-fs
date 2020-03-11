import { promisify } from 'util';

function patchFn(asyncPatchedFsFn) {
  return (...args) => {
    return asyncPatchedFsFn(...args);
  };
}

function open(patchedFsPromisifiedOpen, path, flag, modes) {
  return patchedFsPromisifiedOpen(path, flag, modes);
}

function readdir(patchedFsPromisifiedReaddir, path, options) {
  return patchedFsPromisifiedReaddir(path, options);
}

function readFile(patchedFsPromisifiedReadFile, path, options) {
  return patchedFsPromisifiedReadFile(path, options);
}

function realpath(patchedFsPromisifiedRealpath, path, options) {
  return patchedFsPromisifiedRealpath(path, options);
}

function stat(patchedFsPromisifiedStat, path, options) {
  return patchedFsPromisifiedStat(path, options);
}

export function createPatchedFsPromises(patchedFs) {
  const asyncPatchedFsOpen = promisify(patchedFs.open);
  const asyncPatchedFsReaddir = promisify(patchedFs.readdir);
  const asyncPatchedFsReadFile = promisify(patchedFs.readFile);
  const asyncPatchedFsRealpath = promisify(patchedFs.realpath);
  const asyncPatchedFsStat = promisify(patchedFs.stat);

  return {
    open: patchFn(asyncPatchedFsOpen, open),
    readdir: patchFn(asyncPatchedFsReaddir, readdir),
    readFile: patchFn(asyncPatchedFsReadFile, readFile),
    realpath: patchFn(asyncPatchedFsRealpath, realpath),
    stat: patchFn(asyncPatchedFsStat, stat),
  };
}
