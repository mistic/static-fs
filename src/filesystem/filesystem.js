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

  closeSync(fd) {
    try {
      this.getValidatedFD(fd);
    } catch (e) {
      StaticFilesystem.NewError(constants.errno.ENOENT, 'closeSync', e);
    }

    delete this.fds[fd.id];
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
