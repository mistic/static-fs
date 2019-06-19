import { resolve } from 'path';
import { constants } from 'os';

import { unixifyPath, select, selectMany, first } from '../common';
import { ReadableStaticVolume } from './volume';

export class StaticFilesystem {
  constructor() {
    this.volumes = [];
  }

  NewError(code, method, filepath) {
    switch (code) {
      case constants.errno.ENOENT:
        return {
          ... new Error(`ENOENT: no such file or directory, ${method} '${filepath}'`),
          code: 'ENOENT',
          path: filepath,
          errno: constants.errno.ENOENT
        };
      case constants.errno.EISDIR:
        return {
          ... new Error(`EISDIR: illegal operation on a directory, ${method} '${filepath}'`),
          code: 'EISDIR',
          path: filepath,
          errno: constants.errno.EISDIR
        };
    }
    return {
      ... new Error(`UNKNOWN: Error, ${method} '${filepath}'`),
      code: 'UNKNOWN',
      path: filepath,
      errno: -10000
    };
  }

  shutdown() {
    for (const volume of this.volumes) {
      volume.shutdown();
    }
  }

  get hashes() {
    return select(this.volumes, (p, c, i, a) => c.hash);
  }

  load(sourcePath, projectRelRoot) {
    sourcePath = resolve(sourcePath);
    for (let i = 0; i < this.volumes.length; i++) {
      if (this.volumes[i].sourcePath === sourcePath) {
        // already loaded?
        return this;
      }
    }
    const volume = new ReadableStaticVolume(sourcePath, resolve(projectRelRoot));
    volume.load();
    this.volumes.push(volume);
    return this;
  }

  get loadedVolumes(){
    return select(this.volumes, (p, c) => c.sourcePath);
  }

  unload(sourcePath) {
    sourcePath = resolve(sourcePath);

    for (let i = 0; i < this.volumes.length; i++) {
      if (this.volumes[i].sourcePath === sourcePath) {
        this.volumes[i].shutdown();
        this.volumes.splice(i, 1);
      }
    }
    return this;
  }

  get entries() {
    return selectMany(this.volumes, (p, c) => Object.keys(c.index));
  }

  readFileSync(filepath, options) {
    const targetPath = unixifyPath(filepath);
    return first(
      this.volumes,
      (volume) => volume.readFileSync(targetPath, options),
      () => { throw this.NewError(constants.errno.ENOENT, "readFileSync", filepath) }
    );
  }

  readFile(filepath, options, callback){
    const targetPath = unixifyPath(filepath);
    first(
      this.volumes,
      (volume) => {
        const foundFile = volume.readFileSync(targetPath, options);
        process.nextTick(() => {
          callback(undefined, foundFile);
        });
        return foundFile;
      },
      () => { throw this.NewError(constants.errno.ENOENT, "readFile", filepath)}
    );
  }

  realpathSync(filepath) {
    const targetPath = unixifyPath(filepath);
    return first(this.volumes, (volume) => volume.index[targetPath] ? targetPath : undefined, () => { throw this.NewError(constants.errno.ENOENT, "realpathSync", filepath) });
  }

  realpath(filepath, callback) {
    const targetPath = unixifyPath(filepath);
    first(
      this.volumes,
      (volume) => {
        const foundPath = volume.index[targetPath] ? targetPath : undefined;
        process.nextTick(() => {
          callback(undefined, foundPath);
        });
        return foundPath;
      },
      () => { throw this.NewError(constants.errno.ENOENT, "realpath", filepath) }
    );
  }

  statSync(filepath) {
    const targetPath = unixifyPath(filepath);
    return first(this.volumes, (volume) => volume.index[targetPath], () => { throw this.NewError(constants.errno.ENOENT, "statSync", filepath) });
  }

  stat(filepath, callback) {
    const targetPath = unixifyPath(filepath);
    first(
      this.volumes,
      (volume) => {
        const foundStat = volume.index[targetPath];
        process.nextTick(() => {
          callback(undefined, foundStat);
        });
        return foundStat;
        },
      () => { throw this.NewError(constants.errno.ENOENT, "stat", filepath) }
      );
  }

  readdirSync(filepath) {
    const targetPath = unixifyPath(filepath);
    return first(
      this.volumes,
      (volume) => Object.keys(volume.directoriesIndex[targetPath]) || [],
      () => { throw this.NewError(constants.errno.ENOENT, "readdirSync", filepath) }
    );
  }

  readdir(filepath, callback) {
    const targetPath = unixifyPath(filepath);
    first(
      this.volumes,
      (volume) => {
        const foundDir = volume.directoriesIndex[targetPath];
        process.nextTick(() => {
          callback(undefined, Object.keys(volume.directoriesIndex[targetPath]));
        });
        return foundDir;
      },
      () => { throw this.NewError(constants.errno.ENOENT, "readdir", filepath) }
    );
  }
}
