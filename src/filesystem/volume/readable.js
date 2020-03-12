import * as realFs from 'fs';
import { dirname, resolve } from 'path';
import { calculateHash, INT_SIZE, strToEncoding, unixifyPath } from '../../common';

export class ReadableStaticVolume {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
    this.indexPath = resolve(dirname(this.sourcePath), 'static_fs_index.json');
    this.moutingRoot = resolve(dirname(this.sourcePath), '../');
    this.runtimePath = resolve(dirname(this.sourcePath), 'static_fs_runtime.js');
    this.reset();
  }

  reset() {
    this.directoriesIndex = {};
    this.filesBeingRead = {};
    this.filesIndex = {};
    this.hash = '';
    this.volumeFd = -1;
    this.volumeStats = {};
  }

  load() {
    // already load?
    if (this.volumeFd >= 0) {
      return;
    }

    // read the index
    this.volumeFd = realFs.openSync(this.sourcePath, 'r');

    // read first int into int buffer
    const intBuffer = Buffer.alloc(INT_SIZE);

    // read hash
    let hashSize = this.readInt(intBuffer);
    let hashBuffer = Buffer.alloc(hashSize);

    this.readBuffer(hashBuffer, hashSize);
    this.hash = hashBuffer.toString('utf8', 0, hashSize);

    const indexContent = JSON.parse(realFs.readFileSync(this.indexPath, 'utf8'));
    this.volumeStats = this.buildVolumeStatsFromJSON(indexContent.volumeStats);
    this.directoriesIndex = indexContent.directoriesIndex;
    this.filesIndex = indexContent.filesIndex;

    // verify hash
    const hashCheckIndex = new Set();
    Object.keys(this.filesIndex).forEach((filePath) => hashCheckIndex.add(filePath));

    const hashCheck = calculateHash(Array.from(hashCheckIndex.values()).sort());
    if (hashCheck !== this.hash) {
      throw new Error(
        `Something went wrong loading the volume ${this.sourcePath}. Check hash after loading is different from the one stored in the volume.`,
      );
    }
  }

  buildVolumeStatsFromJSON(jsonVolumeStats) {
    return {
      isDirectory: () => false,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFile: () => true,
      isFIFO: () => false,
      isSocket: () => false,
      ...jsonVolumeStats,
      atime: new Date(jsonVolumeStats.atime),
      mtime: new Date(jsonVolumeStats.mtime),
      ctime: new Date(jsonVolumeStats.ctime),
      birthtime: new Date(jsonVolumeStats.birthtime),
    };
  }

  readBuffer(buffer, length) {
    return realFs.readSync(this.volumeFd, buffer, 0, length || buffer.length, null);
  }

  readInt(intBuffer) {
    realFs.readSync(this.volumeFd, intBuffer, 0, INT_SIZE, null);
    return intBuffer.readIntBE(0, 6);
  }

  shutdown() {
    // In case fd is open close it
    // to release the file
    if (this.volumeFd > 0) {
      realFs.closeSync(this.volumeFd);
    }

    this.reset();
  }

  getFromFilesIndex(filePath) {
    return this.filesIndex[this._resolveAndUnmountPath(filePath)];
  }

  getFromDirectoriesIndex(dirPath) {
    return this.directoriesIndex[this._resolveAndUnmountPath(dirPath)];
  }

  getFromIndex(itemPath) {
    const fileItem = this.getFromFilesIndex(itemPath);
    const dirItem = this.getFromDirectoriesIndex(itemPath);

    if (!fileItem && !dirItem) {
      return null;
    }

    const item = fileItem
      ? Object.assign({}, fileItem, { isDirectory: () => false, isFile: () => true })
      : { isDirectory: () => true, isFile: () => false };

    return {
      ...this.volumeStats,
      ...item,
      blocks: fileItem ? 1 : 0,
      blksize: fileItem ? fileItem.size : this.volumeStats.blksize,
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

    return strToEncoding(filePath, encoding);
  }

  getDirInfo(dirPath, encoding = 'utf8', withFileTypes = false) {
    const dirIdxData = this.getFromDirectoriesIndex(dirPath);
    if (!dirIdxData) {
      return undefined;
    }

    return dirIdxData.sort().map((dirInfoElem) => {
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

  _resolveAndUnmountPath(mountedPath) {
    if (!mountedPath.includes(this.moutingRoot)) {
      return mountedPath;
    }

    // mountRoot path + slash
    return unixifyPath(mountedPath).slice(unixifyPath(this.moutingRoot).length + 1);
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
    realFs.readSync(this.volumeFd, buf, 0, item.size, item.ino);

    if (!encoding) {
      return buf;
    }

    return buf.toString(encoding, 0, item.size);
  }

  _deleteReadFileFromCache(filePath) {
    if (this.filesBeingRead[filePath]) {
      delete this.filesBeingRead[filePath];
    }
  }

  _readFromCache(filePath, buffer, offset, length, position) {
    const cachedBuffer = this.filesBeingRead[filePath];

    if (position >= cachedBuffer.length) {
      this._deleteReadFileFromCache(filePath);
      return 0;
    }

    const copiedBytes = cachedBuffer.copy(buffer, offset, position, Math.min(position + length, cachedBuffer.length));
    if (copiedBytes + position === cachedBuffer.length) {
      this._deleteReadFileFromCache(filePath);
    }

    return copiedBytes;
  }

  readSync(filePath, buffer, offset, length, position) {
    const item = this.getFromIndex(filePath);

    if (!item || !item.isFile()) {
      return undefined;
    }

    if (position >= item.size) {
      // it is not possible to read
      // more than the file size
      return 0;
    }

    if (this.filesBeingRead[filePath]) {
      return this._readFromCache(filePath, buffer, offset, length, position);
    } else {
      const cachedFileBuffer = (this.filesBeingRead[filePath] = Buffer.alloc(item.size));

      realFs.readSync(this.volumeFd, cachedFileBuffer, 0, item.size, item.ino);
      return this._readFromCache(filePath, buffer, offset, length, position);
    }
  }
}
