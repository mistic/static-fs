import { resolve } from 'path';
import { constants } from 'os';
import { sanitizePath } from '../common';
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

  getValidatedFD(fd) {
    if (!fd || !fd.type || fd.type !== 'static_fs_file_descriptor') {
      throw StaticFilesystem.NewError(constants.errno.EBADF, 'getValidatedFD', fd);
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      throw StaticFilesystem.NewError(constants.errno.EBADF, 'getValidatedFD', fd);
    }

    return sfsFd;
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

  // string, buffer or FD to read file
  readFileSync(filePath, options) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readFileSync', filePath);
    }

    return volume.readFileSync(filePath, options);
  }

  readFile(filePath, options, callback) {
    this.wrapAsync(this.readFileSync, [filePath, options], callback);
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
  realpathSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'realpathSync', filePath);
    }

    return volume.getFromIndex(filePath) ? sanitizePath(filePath) : undefined;
  }

  realpath(filePath, callback) {
    this.wrapAsync(this.realpathSync, [filePath], callback);
  }

  // bigint
  statSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'statSync', filePath);
    }

    return volume.getFromIndex(filePath);
  }

  stat(filePath, callback) {
    this.wrapAsync(this.statSync, [filePath], callback);
  }

  // encoding, withFileTypes
  readdirSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readdirSync', filePath);
    }

    return Object.keys(volume.getFromDirectoriesIndex(filePath)) || [];
  }

  readdir(filePath, callback) {
    this.wrapAsync(this.readdirSync, [filePath], callback);
  }

  openSync(filePath) {
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

  open(filePath, callback) {
    this.wrapAsync(this.openSync, [filePath], callback);
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

  // bigint
  fstatSync(fd) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'fstatSync', e);
    }

    return this.statSync(fd.filePath);
  }

  fstat(fd, callback) {
    this.wrapAsync(this.fstatSync, [fd], callback);
  }

  createReadStream(filePath, options) {
    return new ReadStream(this, filePath, options);
  }
}
