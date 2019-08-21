import { resolve } from 'path';
import { constants } from 'os';
import { sanitizePath } from '../common';
import { ReadStream } from './streams';
import { ReadableStaticVolume } from './volume';

export class StaticFilesystem {
  static NewError(code, method, filepath) {
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

  constructor() {
    this.volumes = {};
    this.fds = {};
    this.pathVolumeMap = {};
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

  readFileSync(filePath, options) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'readFileSync', filePath);
    }

    return volume.readFileSync(filePath, options);
  }

  readFile(filePath, options, callback) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'readFile', filePath));
      });
      return;
    }

    const foundFile = volume.readFileSync(filePath, options);
    process.nextTick(() => {
      callback(undefined, foundFile);
    });
  }

  read(fd, buffer, offset, length, position, callback) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      process.nextTick(() => {
        callback(e);
      });
      return;
    }

    const filePath = fd.filePath;
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'read', fd));
      });
      return;
    }

    process.nextTick(() => {
      volume.read(filePath, buffer, offset, length, position, callback);
    });
  }

  realpathSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      throw StaticFilesystem.NewError(constants.errno.ENOENT, 'realpathSync', filePath);
    }

    return volume.getFromIndex(filePath) ? sanitizePath(filePath) : undefined;
  }

  realpath(filePath, callback) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'realpath', filePath));
      });
      return;
    }

    const foundPath = volume.getFromIndex(filePath) ? sanitizePath(filePath) : undefined;
    process.nextTick(() => {
      callback(undefined, foundPath);
    });
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

  statSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      StaticFilesystem.NewError(constants.errno.ENOENT, 'statSync', filePath);
    }

    return volume.getFromIndex(filePath);
  }

  stat(filePath, callback) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'stat', filePath));
      });
      return;
    }

    const foundStat = volume.getFromIndex(filePath);
    process.nextTick(() => {
      callback(undefined, foundStat);
    });
  }

  readdirSync(filePath) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      StaticFilesystem.NewError(constants.errno.ENOENT, 'readdirSync', filePath);
    }

    return Object.keys(volume.getFromDirectoriesIndex(filePath)) || [];
  }

  readdir(filePath, callback) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'readdir', filePath));
      });
      return;
    }

    process.nextTick(() => {
      callback(undefined, Object.keys(volume.getFromDirectoriesIndex(filePath)) || []);
    });
  }

  getValidatedFD(fd) {
    if (!fd || !fd.type || fd.type !== 'static_fs_file_descriptor') {
      throw StaticFilesystem.NewError(constants.errno.EBADF, 'getValidatedFD', fd);
    }

    const sfsFd = this.fds[fd.id];
    if (!sfsFd) {
      throw StaticFilesystem.NewError(constants.errno.EEXIST, 'getValidatedFD', fd);
    }

    return sfsFd;
  }

  open(filePath, callback) {
    const volume = this.volumeForFilepathSync(filePath);

    if (!volume) {
      process.nextTick(() => {
        callback(StaticFilesystem.NewError(constants.errno.ENOENT, 'open', filePath));
      });
      return;
    }

    const fdIdentifier = `${volume.sourcePath}#${sanitizePath(filePath)}`;
    this.fds[fdIdentifier] = {
      type: 'static_fs_file_descriptor',
      id: fdIdentifier,
      volumeSourcePath: volume.sourcePath,
      filePath: filePath,
    };

    process.nextTick(() => {
      callback(undefined, this.fds[fdIdentifier]);
    });
  }

  close(fd, callback) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      process.nextTick(() => {
        callback(e);
      });
      return;
    }

    delete this.fds[fd.id];
    process.nextTick(() => {
      callback();
    });
  }

  fstat(fd, callback) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      process.nextTick(() => {
        callback(e);
      });
      return;
    }

    this.stat(fd.filePath, callback);
  }

  createReadStream(filePath, options) {
    return new ReadStream(this, filePath, options);
  }
}
