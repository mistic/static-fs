import { constants as fsConstants } from 'fs';
import { resolve } from 'path';
import { constants } from 'os';
import { nodePathToString, unixifyPath } from '../common';
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
      case constants.errno.ENOTDIR:
        return {
          ...new Error(`ENOTDIR: not a directory, ${method} '${data}'`),
          code: 'ENOTDIR',
          path: data,
          errno: constants.errno.ENOTDIR,
        };
      case constants.errno.EROFS:
        return {
          ...new Error(`EROFS: static-fs is a read-only filesystem, ${method} '${data}'`),
          code: 'EROFS',
          path: data,
          errno: constants.errno.EROFS,
        };
      case constants.errno.EACCES:
        return {
          ...new Error(`EACCES: permission denied, ${method} '${data}'`),
          code: 'EACCES',
          path: data,
          errno: constants.errno.EACCES,
        };
    }
    return {
      ...new Error(`UNKNOWN_ERROR: Something unexpected happened , ${method} ${data}`),
      code: 'UNKNOWN_ERROR',
      info: data,
      errno: -9999,
    };
  }

  constructor() {
    this.fds = {};
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
    volume.load();
    this.volumes[volume.sourcePath] = volume;

    return this;
  }

  get loadedVolumes() {
    return Object.keys(this.volumes);
  }

  areFlagsValid(flags) {
    return !(flags && flags !== 'r');
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

  getVolumeForPath(itemPath) {
    const volKeys = Object.keys(this.volumes);
    for (let i = 0; i < volKeys.length; i++) {
      const vol = this.volumes[volKeys[i]];
      const exists = vol.getRealpath(itemPath);

      if (exists) {
        return volKeys[i];
      }
    }

    return undefined;
  }

  volumeForFilepathSync(itemPath) {
    const volumePathForFilePath = this.getVolumeForPath(itemPath);

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

  accessSync(path, mode) {
    const filePath = nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'accessSync', filePath);
    }

    if (mode !== fsConstants.F_OK && mode !== fsConstants.R_OK && mode !== fsConstants.X_OK) {
      throw StaticFilesystem.NewError(constants.errno.EACCES, 'accessSync', filePath);
    }
  }

  access(path, mode, callback) {
    this.wrapAsync(this.accessSync, [path, mode], callback);
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

  realpathSync(path, options) {
    const filePath = nodePathToString(path);
    const encoding = options && options.encoding;
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'realpathSync', filePath);
    }

    return volume.getRealpath(filePath, encoding);
  }

  realpath(path, options, callback) {
    this.wrapAsync(this.realpathSync, [path, options], callback);
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

  readdirSync(path, options) {
    const dirPath = nodePathToString(path);
    const encoding = options && options.encoding;
    const withFileTypes = options && options.withFileTypes;
    const volume = this.volumeForFilepathSync(dirPath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readdirSync', dirPath);
    }

    const dirInfo = volume.getDirInfo(dirPath, encoding, withFileTypes);
    if (!dirInfo) {
      throw StaticFilesystem.NewError(constants.errno.ENOTDIR, 'readdirSync', dirPath);
    }

    return dirInfo;
  }

  readdir(path, options, callback) {
    this.wrapAsync(this.readdirSync, [path, options], callback);
  }

  openSync(path, flags) {
    const filePath = nodePathToString(path);
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'openSync', filePath);
    }

    if (!this.areFlagsValid(flags)) {
      throw StaticFilesystem.NewError(constants.errno.EROFS, 'openSync', filePath);
    }

    const fdIdentifier = `${volume.sourcePath}#${unixifyPath(filePath)}`;
    this.fds[fdIdentifier] = {
      type: 'static_fs_file_descriptor',
      id: fdIdentifier,
      volumeSourcePath: volume.sourcePath,
      filePath: filePath,
    };

    return this.fds[fdIdentifier];
  }

  open(path, flags, callback) {
    this.wrapAsync(this.openSync, [path, flags], callback);
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
    const optionsFlags = options && options.flags;
    const optionsFd = options && options.fd;
    const filePath = optionsFd ? path : nodePathToString(path);

    if (!this.areFlagsValid(optionsFlags)) {
      throw StaticFilesystem.NewError(constants.errno.EROFS, 'createReadStream', filePath);
    }

    return new ReadStream(this, filePath, options);
  }
}
