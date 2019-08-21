import { resolve } from 'path';
import { constants } from 'os';
import { sanitizePath } from '../common';
import { ReadStream } from './streams';
import { ReadableStaticVolume } from './volume';

export class StaticFilesystem {
  constructor() {
    this.volumes = {};
    this.fds = {};
    this.pathVolumeMap = {};
  }

  NewError(code, method, filepath) {
    switch (code) {
      case constants.errno.ENOENT:
        return {
          ...new Error(`ENOENT: no such file or directory, ${method} '${filepath}'`),
          code: 'ENOENT',
          path: filepath,
          errno: constants.errno.ENOENT,
        };
      case constants.errno.EISDIR:
        return {
          ...new Error(`EISDIR: illegal operation on a directory, ${method} '${filepath}'`),
          code: 'EISDIR',
          path: filepath,
          errno: constants.errno.EISDIR,
        };
    }
    return {
      ...new Error(`UNKNOWN: Error, ${method} '${filepath}'`),
      code: 'UNKNOWN',
      path: filepath,
      errno: -10000,
    };
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

  unload(sourcePath) {
    sourcePath = resolve(sourcePath);

    if (!this.volumes[sourcePath]) {
      return this;
    }

    const volumeToUnload = this.volumes[sourcePath];
    if (volumeToUnload.sourcePath !== sourcePath) {
      return this;
    }

    volumeToUnload.shutdown();

    return this;
  }

  get entries() {
    return Object.keys(this.pathVolumeMap);
  }

  readFileSync(filepath, options) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      throw this.NewError(constants.errno.ENOENT, 'readFileSync', filepath);
    }

    return volume.readFileSync(targetPath, options);
  }

  readFile(filepath, options, callback) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      throw this.NewError(constants.errno.ENOENT, 'readFile', filepath);
    }

    const foundFile = volume.readFileSync(targetPath, options);
    process.nextTick(() => {
      callback(undefined, foundFile);
    });
  }

  read(fd, buffer, offset, length, position, callback) {
    if (fd.type !== 'static_fs_file_descriptor') {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EBADF, 'read', fd));
      });
      return;
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EEXIST, 'read', fd));
      });
      return;
    }

    const filePath = sfsFd.filePath;
    const targetPath = sanitizePath(filePath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      throw this.NewError(constants.errno.ENOENT, 'read', fd);
    }

    volume.read(targetPath, buffer, offset, length, position, callback);
  }

  realpathSync(filepath) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      throw this.NewError(constants.errno.ENOENT, 'realpathSync', filepath);
    }

    return volume.index[targetPath] ? targetPath : undefined;
  }

  realpath(filepath, callback) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      this.NewError(constants.errno.ENOENT, 'realpath', filepath);
    }

    const foundPath = volume.index[targetPath] ? targetPath : undefined;
    process.nextTick(() => {
      callback(undefined, foundPath);
    });
  }

  volumeForFilepathSync(filepath) {
    const targetPath = sanitizePath(filepath);
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

  statSync(filepath) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      this.NewError(constants.errno.ENOENT, 'statSync', filepath);
    }

    return volume.index[targetPath];
  }

  stat(filepath, callback) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      this.NewError(constants.errno.ENOENT, 'stat', filepath);
    }

    const foundStat = volume.index[targetPath];
    process.nextTick(() => {
      callback(undefined, foundStat);
    });
  }

  readdirSync(filepath) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      this.NewError(constants.errno.ENOENT, 'readdirSync', filepath);
    }

    return Object.keys(volume.directoriesIndex[targetPath]) || [];
  }

  readdir(filepath, callback) {
    const targetPath = sanitizePath(filepath);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      this.NewError(constants.errno.ENOENT, 'readdir', filepath);
    }

    process.nextTick(() => {
      callback(undefined, Object.keys(volume.directoriesIndex[targetPath]) || []);
    });
  }

  getPathForFD(fd) {
    if (!fd || !fd.type || fd.type !== 'static_fs_file_descriptor') {
      return null;
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      return null;
    }

    return sfsFd.filePath;
  }

  open(path, callback) {
    const targetPath = sanitizePath(path);
    const volume = this.volumeForFilepathSync(targetPath);

    if (!volume) {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.ENOENT, 'open', path));
      });
      return;
    }

    const fdIdentifier = `${volume.sourcePath}#${targetPath}`;
    this.fds[fdIdentifier] = {
      type: 'static_fs_file_descriptor',
      id: fdIdentifier,
      volumeSourcePath: volume.sourcePath,
      filePath: path,
    };

    process.nextTick(() => {
      callback(undefined, this.fds[fdIdentifier]);
    });
  }

  close(fd, callback) {
    if (fd.type !== 'static_fs_file_descriptor') {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EBADF, 'close', fd));
      });
      return;
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EEXIST, 'close', fd));
      });
      return;
    }

    delete this.fds[fd.id];
    process.nextTick(() => {
      callback();
    });
  }

  fstat(fd, callback) {
    if (fd.type !== 'static_fs_file_descriptor') {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EBADF, 'fstat', fd));
      });
      return;
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      process.nextTick(() => {
        callback(this.NewError(constants.errno.EEXIST, 'fstat', fd));
      });
      return;
    }

    this.stat(sfsFd.filePath, callback);
  }

  createReadStream(path, options) {
    return new ReadStream(this, path, options);
  }
}
