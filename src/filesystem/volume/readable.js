import * as realFs from 'fs';
import { basename, dirname, resolve } from 'path';
import { calculateHash, INT_SIZE, sanitizePath, strToEncoding, unixifyPath } from '../../common';

export class ReadableStaticVolume {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
    this.moutingRoot = resolve(dirname(this.sourcePath), '../');
    this.runtimePath = resolve(dirname(this.sourcePath), 'static_fs_runtime.js');
    this.reset();
  }

  reset() {
    this.directoriesIndex = {};
    this.fd = -1;
    this.filesBeingRead = {};
    this.filesIndex = {};
    this.hash = '';
    this.statData = {};
  }

  load() {
    // already load?
    if (this.fd >= 0) {
      return;
    }

    // clone the original static fs values and set some defaults
    this.statData = {
      isDirectory: () => false,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFile: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      size: 0,
      ...realFs.statSync(this.sourcePath),
    };

    // read the index
    this.fd = realFs.openSync(this.sourcePath, 'r');

    // init buffers
    let buf = Buffer.alloc(1024 * 16);
    const intBuffer = Buffer.alloc(INT_SIZE);

    // read first int into int buffer
    let dataOffset = this.readInt(intBuffer);

    // read hash
    let hashSize = this.readInt(intBuffer);
    if (hashSize > buf.length) {
      buf = Buffer.alloc(hashSize);
    }
    this.readBuffer(buf, hashSize);
    this.hash = buf.toString('utf8', 0, hashSize);

    const hashCheckIndex = {};

    // this stores an index (every_path) -> (sourcePath)
    const pathVolumeIndex = {};

    do {
      const nameSz = this.readInt(intBuffer);
      if (nameSz === 0) {
        break;
      }
      const dataSz = this.readInt(intBuffer);
      if (nameSz > buf.length) {
        buf = Buffer.alloc(nameSz);
      }
      this.readBuffer(buf, nameSz);
      const name = buf.toString('utf8', 0, nameSz);
      const mountedName = this._resolveMountedPath(name);

      hashCheckIndex[name] = true;

      // add entry for file into index
      this.filesIndex[mountedName] = {
        ino: dataOffset, // the location in the static fs
        size: dataSz, // the size of the file
      };

      pathVolumeIndex[mountedName] = this.sourcePath;

      // build our directories index
      // also update pathVolumeIndex for every folder and its parent
      this.updateDirectoriesIndex(mountedName, pathVolumeIndex);

      dataOffset += dataSz;
    } while (true);

    const hashCheck = calculateHash(Object.keys(hashCheckIndex).sort());
    if (hashCheck !== this.hash) {
      throw new Error(
        `Something went wrong loading the volume ${this.sourcePath}. Check hash after loading is different from the one stored in the volume.`,
      );
    }

    return pathVolumeIndex;
  }

  readBuffer(buffer, length) {
    return realFs.readSync(this.fd, buffer, 0, length || buffer.length, null);
  }

  readInt(intBuffer) {
    realFs.readSync(this.fd, intBuffer, 0, INT_SIZE, null);
    return intBuffer.readIntBE(0, 6);
  }

  shutdown() {
    // In case fd is open close it
    // to release the file
    if (this.fd > 0) {
      realFs.closeSync(this.fd);
    }

    this.reset();
  }

  getFromDirectoriesIndex(dirPath) {
    return this.directoriesIndex[sanitizePath(dirPath)];
  }

  getFromIndex(filePath) {
    const fileItem = this.filesIndex[sanitizePath(filePath)];
    const dirItem = this.directoriesIndex[sanitizePath(filePath)];

    if (!fileItem && !dirItem) {
      return null;
    }

    const item = fileItem
      ?  Object.assign({}, fileItem, { isDirectory : () => false, isFile: () => true })
      : { isDirectory : () => true, isFile: () => false };

    return {
      ...this.statData,
      ...item,
      blocks: fileItem ? 1 : 0,
      blksize: fileItem ? fileItem.size : this.statData.blksize
    };
  }

  getStatsFromFilepath(filePath, bigInt = false) {
    const baseStats = this.getFromIndex(filePath);

    if (!bigInt) {
      return baseStats;
    }

    const getBigInt = (num) => {
      if (typeof BigInt !== 'function') {
        throw new Error('BigInt is not supported.');
      }

      return BigInt(num);
    };

    const bigIntStats = [
      'size',
      'dev',
      'mode',
      'nlink',
      'uid',
      'gid',
      'rdev',
      'blksize',
      'ino',
      'blocks',
      'atimeMs',
      'mtimeMs',
      'ctimeMs',
      'birthtimeMs',
    ].reduce((newStats, statVal) => {
      if (Object.prototype.hasOwnProperty.call(baseStats, statVal)) {
        newStats[statVal] = getBigInt(baseStats[statVal]);
      }

      return newStats;
    }, {});

    return {
      ...baseStats,
      ...bigIntStats(),
    };
  }

  getRealpath(filePath, encoding = 'utf8') {
    if (!this.getFromIndex(filePath)) {
      return undefined;
    }

    return strToEncoding(sanitizePath(filePath), encoding);
  }

  getDirInfo(dirPath, encoding = 'utf8', withFileTypes = false) {
    const dirIdxData = this.getFromDirectoriesIndex(dirPath);
    if (!dirIdxData) {
      return undefined;
    }

    const baseDirInfo = Object.keys(dirIdxData);
    return baseDirInfo.sort().map((dirInfoElem) => {
      const encodedDirInfoElem = strToEncoding(dirInfoElem, encoding);

      if (!withFileTypes) {
        return encodedDirInfoElem;
      }

      const isElemDir = !!this.getFromDirectoriesIndex(dirInfoElem);

      return {
        name: encodedDirInfoElem,
        isDirectory: () => isElemDir,
        isFile: () => !isElemDir,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
      };
    });
  }

  updateDirectoriesIndex(name, pathVolumeIndex) {
    if (unixifyPath(this.moutingRoot) === name) {
      return;
    }

    const item = this.getFromIndex(name);
    const parent = dirname(name);

    if (item.isFile() || item.isDirectory()) {
      const fileName = basename(name);
      if (!this.directoriesIndex[parent]) {
        this.directoriesIndex[parent] = {};
        pathVolumeIndex[parent] = this.sourcePath;
      }

      this.directoriesIndex[parent][fileName] = true;
    }

    this.updateDirectoriesIndex(parent, pathVolumeIndex);
  }

  _resolveMountedPath(unmountedPath) {
    if (unmountedPath.includes(this.moutingRoot)) {
      return unmountedPath;
    }

    return sanitizePath(this.moutingRoot, unmountedPath);
  }

  readFileSync(filePath, options) {
    const item = this.getFromIndex(filePath);

    if (!item || !item.isFile()) {
      return undefined;
    }

    const encoding = options
      ? typeof options === 'string'
        ? options
        : typeof options === 'object'
        ? options.encoding
        : null
      : null;

    // alloc buffer
    const buf = Buffer.alloc(item.size);

    // read the content and return a string
    realFs.readSync(this.fd, buf, 0, item.size, item.ino);

    if (!encoding) {
      return buf;
    }

    return buf.toString(encoding, 0, item.size);
  }

  _deleteReadFileFromCache(filePath, length, position) {
    const cachedBuffer = this.filesBeingRead[filePath].buffer;

    if (position >= cachedBuffer.length || position + length >= cachedBuffer.length) {
      this.filesBeingRead[filePath].consumers -= 1;
    }

    if (this.filesBeingRead[filePath].consumers <= 0) {
      delete this.filesBeingRead[filePath];
    }
  }

  _readFromCache(filePath, buffer, offset, length, position) {
    const cachedBuffer = this.filesBeingRead[filePath].buffer;

    if (position >= cachedBuffer.length) {
      this._deleteReadFileFromCache(filePath, length, position);
      return 0;
    }

    const copiedBytes = cachedBuffer.copy(buffer, offset, position, Math.min(position + length, cachedBuffer.length));
    this._deleteReadFileFromCache(filePath, length, position);
    return copiedBytes;
  }

  readSync(filePath, buffer, offset, length, position) {
    const item = this.getFromIndex(filePath);

    if (item && item.isFile()) {
      // read the content and return a string
      if (this.filesBeingRead[filePath]) {
        this.filesBeingRead[filePath].consumers += 1;
        return this._readFromCache(filePath, buffer, offset, length, position);
      } else {
        const cachedFile = (this.filesBeingRead[filePath] = {
          buffer: Buffer.alloc(item.size),
          consumers: 1,
        });

        realFs.readSync(this.fd, cachedFile.buffer, 0, item.size, item.ino);
        return this._readFromCache(filePath, buffer, offset, length, position);
      }
    } else {
      throw new Error(`The path you are trying to read is not a file: ${filePath}`);
    }
  }
}
