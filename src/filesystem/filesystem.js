import { resolve } from 'path';
import { constants } from 'os';
import { nodePathToString, sanitizePath } from '../common';
import { ReadStream } from './streams';
import { ReadableStaticVolume } from './volume';

export class StaticFilesystem {
  static NewError(code, method, data) {
    switch (code) {
      case constants.errno.ENOENT:
        return {
          ...new Error(`ENOENT: no such file or directory, ${method} '${data}'`),
          code: 'ENOENT',
          path: data,
          errno: constants.errno.ENOENT,
        };
      case constants.errno.EISDIR:
        return {
          ...new Error(`EISDIR: illegal operation on a directory, ${method} '${data}'`),
          code: 'EISDIR',
          path: data,
          errno: constants.errno.EISDIR,
        };
      case constants.errno.EBADF:
        return {
          ...new Error(`EBADF: bad file number, ${method} ${data}`),
          code: 'EBADF',
          info: data,
          errno: constants.errno.EBADF,
        };
    }
    return {
      ...new Error(`UNKNOWN: Error, ${method} ${data}`),
      code: 'UNKNOWN',
      info: data,
      errno: -10000,
    };
  }

  constructor() {
    this.fds = {};
    this.pathVolumeMap = {};
    this.volumes = {};
  }

  shutdown() {
    for (const volume of Object.values(this.volumes)) {
      volume.shutdown();
    }
  }

  load(sourcePath) {
    sourcePath = resolve(sourcePath);

    if (this.volumes[sourcePath]) {
      // already loaded?
      return this;
    }

    const volume = new ReadableStaticVolume(sourcePath);
    const pathVolumeIndex = volume.load();

    this.pathVolumeMap = {
      ...this.pathVolumeMap,
      ...pathVolumeIndex,
    };

    this.volumes[volume.sourcePath] = volume;
    return this;
  }

  get loadedVolumes() {
    return Object.keys(this.volumes);
  }

  get entries() {
    return Object.keys(this.pathVolumeMap);
  }

  isValidFD(fd) {
    const isCorrectFormat = fd && fd.id && fd.type && fd.type === 'static_fs_file_descriptor';
    const isPresent = this.fds[fd.id];

    return isCorrectFormat && isPresent;
  }

  getValidatedFD(fd) {
    if (!this.isValidFD(fd)) {
      throw StaticFilesystem.NewError(constants.errno.EBADF, 'getValidatedFD', fd);
    }

    return this.fds[fd.id];
  }

  volumeForFilepathSync(filePath) {
    const targetPath = sanitizePath(filePath);
    const volumePathForFilePath = this.pathVolumeMap[targetPath];

    if (!volumePathForFilePath) {
      return undefined;
    }

    const volumeForFilePath = this.volumes[volumePathForFilePath];

    if (!volumeForFilePath) {
      return undefined;
    }

    return volumeForFilePath;
  }

  wrapAsync(method, args, callback) {
    if (typeof callback !== 'function') throw new Error('Callback is not a function');
    process.nextTick(() => {
      try {
        callback(null, method.apply(this, args));
      } catch (err) {
        err.message = err.message.replace(/Sync/gi, '');
        callback(err);
      }
    });
  }

  readFileSync(path, options) {
    const isFd = this.isValidFD(path);
    const filePath = isFd ? path.filePath : nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readFileSync', filePath);
    }

    return volume.readFileSync(filePath, options);
  }

  readFile(path, options, callback) {
    this.wrapAsync(this.readFileSync, [path, options], callback);
  }

  readSync(fd, buffer, offset, length, position) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readSync', e);
    }

    const filePath = fd.filePath;
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readSync', fd);
    }

    return volume.readSync(filePath, buffer, offset, length, position);
  }

  read(fd, buffer, offset, length, position, callback) {
    // copied from Node implementation
    if (length === 0) {
      return process.nextTick(() => {
        if (callback) callback(null, 0, buffer);
      });
    }

    process.nextTick(() => {
      try {
        const readBytes = this.readSync(fd, buffer, offset, length, position);
        callback(null, readBytes, buffer);
      } catch (err) {
        err.message = err.message.replace(/Sync/gi, '');
        callback(err);
      }
    });
  }

  // encoding => strToEncoding
  realpathSync(path) {
    const filePath = nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'realpathSync', filePath);
    }

    return volume.getFromIndex(filePath) ? sanitizePath(filePath) : undefined;
  }

  realpath(path, callback) {
    this.wrapAsync(this.realpathSync, [path], callback);
  }

  statSync(path, options) {
    const filePath = nodePathToString(path);
    const bigInt = options && options.bigint;
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'statSync', filePath);
    }

    return volume.getStatsFromFilepath(filePath, bigInt);
  }

  stat(path, options, callback) {
    this.wrapAsync(this.statSync, [path, options], callback);
  }

  // encoding, withFileTypes
  readdirSync(path) {
    const filePath = nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readdirSync', filePath);
    }

    return Object.keys(volume.getFromDirectoriesIndex(filePath)) || [];
  }

  readdir(path, callback) {
    this.wrapAsync(this.readdirSync, [path], callback);
  }

  openSync(path) {
    const filePath = nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'openSync', filePath);
    }

    const fdIdentifier = `${volume.sourcePath}#${sanitizePath(filePath)}`;
    this.fds[fdIdentifier] = {
      type: 'static_fs_file_descriptor',
      id: fdIdentifier,
      volumeSourcePath: volume.sourcePath,
      filePath: filePath,
    };

    return this.fds[fdIdentifier];
  }

  open(path, callback) {
    this.wrapAsync(this.openSync, [path], callback);
  }

  closeSync(fd) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'closeSync', e);
    }

    delete this.fds[fd.id];
  }

  close(fd, callback) {
    this.wrapAsync(this.closeSync, [fd], callback);
  }

  fstatSync(fd, options) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'fstatSync', e);
    }

    return this.statSync(fd.filePath, options);
  }

  fstat(fd, options, callback) {
    this.wrapAsync(this.fstatSync, [fd, options], callback);
  }

  createReadStream(path, options) {
    return new ReadStream(this, path, options);
  }
}
