import * as realFs from 'fs';
import { basename, dirname, resolve } from 'path';
import { calculateHash, INT_SIZE, sanitizePath, unixifyPath } from '../../common';

export class ReadableStaticVolume {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
    this.moutingRoot = resolve(dirname(this.sourcePath), '../');
    this.runtimePath = resolve(dirname(this.sourcePath), 'static_fs_runtime.js');
    this.reset();
  }

  reset() {
    this.buf = Buffer.alloc(1024 * 16);
    this.directoriesIndex = {};
    this.fd = -1;
    this.filesBeingRead = {};
    this.hash = '';
    this.intBuffer = Buffer.alloc(INT_SIZE);
    this.index = {};
    this.statData = {};
    this.pathVolumeIndex = {};
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
    // close on process exit.
    let dataOffset = this.readInt();

    // read hash
    let hashSize = this.readInt();
    if (hashSize > this.buf.length) {
      this.buf = Buffer.alloc(hashSize);
    }
    this.readBuffer(this.buf, hashSize);
    this.hash = this.buf.toString('utf8', 0, hashSize);

    const hashCheckIndex = {};

    do {
      const nameSz = this.readInt();
      if (nameSz === 0) {
        break;
      }
      const dataSz = this.readInt();
      if (nameSz > this.buf.length) {
        this.buf = Buffer.alloc(nameSz);
      }
      this.readBuffer(this.buf, nameSz);
      const name = this.buf.toString('utf8', 0, nameSz);
      const mountedName = this._resolveMountedPath(name);

      hashCheckIndex[name] = true;

      // add entry for file into index
      this.index[mountedName] = Object.assign({}, this.statData, {
        ino: dataOffset, // the location in the static fs
        size: dataSz, // the size of the file
        blocks: 1, // one block
        blksize: dataSz, // of file size size.
        isFile: () => true, // it's a file!
      });

      // this creates an index (every_path) -> (sourcePath)
      // it also needs to assign inside addParentFolders
      this.pathVolumeIndex[mountedName] = this.sourcePath;

      // ensure parent path has a directory entry
      this.addParentFolders(mountedName);

      // build our directories index
      this.updateDirectoriesIndex(mountedName);

      dataOffset += dataSz;
    } while (true);

    const hashCheck = calculateHash(Object.keys(hashCheckIndex).sort());
    if (hashCheck !== this.hash) {
      throw new Error(
        `Something went wrong loading the volume ${this.sourcePath}. Check hash after loading is different from the one stored in the volume.`,
      );
    }

    return this.pathVolumeIndex;
  }

  readBuffer(buffer, length) {
    return realFs.readSync(this.fd, buffer, 0, length || buffer.length, null);
  }

  readInt() {
    realFs.readSync(this.fd, this.intBuffer, 0, INT_SIZE, null);
    return this.intBuffer.readIntBE(0, 6);
  }

  shutdown() {
    // In case fd is open close it
    // to release the file
    if (this.fd > 0) {
      realFs.closeSync(this.fd);
    }

    this.reset();
  }

  getFromDirectoriesIndex(filePath) {
    return this.directoriesIndex[sanitizePath(filePath)];
  }

  getFromIndex(filePath) {
    return this.index[sanitizePath(filePath)];
  }

  addParentFolders(name) {
    const parent = dirname(name);
    if (parent && !this.index[parent] && parent.includes(unixifyPath(this.moutingRoot))) {
      this.index[parent] = Object.assign({}, this.statData, { isDirectory: () => true });

      this.pathVolumeIndex[parent] = this.sourcePath;

      return this.addParentFolders(parent);
    }
  }

  updateDirectoriesIndex(name) {
    if (!this.index[name] || unixifyPath(this.moutingRoot) === name) {
      return;
    }

    const directoryAlreadyExists = this.directoriesIndex[name];
    if (!directoryAlreadyExists) {
      this.directoriesIndex[name] = {};
    }

    const isFile = this.index[name].isFile();
    const isDirectory = this.index[name].isDirectory();
    const parent = dirname(name);

    if (isFile || isDirectory) {
      const fileName = basename(name);
      if (!this.directoriesIndex[parent]) {
        this.directoriesIndex[parent] = {};
      }

      this.directoriesIndex[parent][fileName] = true;
    }

    this.updateDirectoriesIndex(parent);
  }

  _resolveMountedPath(unmountedPath) {
    if (unmountedPath.includes(this.moutingRoot)) {
      return unmountedPath;
    }

    return sanitizePath(this.moutingRoot, unmountedPath);
  }

  readFileSync(filePath, options) {
    const sanitizedFilePath = sanitizePath(filePath);
    const item = this.index[sanitizedFilePath];

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

    // re-alloc if necessary
    if (this.buf.length < item.size) {
      this.buf = Buffer.alloc(item.size);
    }

    // read the content and return a string
    realFs.readSync(this.fd, this.buf, 0, item.size, item.ino);

    if (!encoding) {
      const buf = Buffer.alloc(item.size);
      this.buf.copy(buf);
      return buf;
    }

    return this.buf.toString(encoding, 0, item.size);
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
    const sanitizedFilePath = sanitizePath(filePath);
    const item = this.index[sanitizedFilePath];

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
