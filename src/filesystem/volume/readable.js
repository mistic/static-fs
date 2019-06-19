import { dirname, basename} from 'path';
import fs from 'fs';
import { INTSIZE, unixifyPath } from '../../common';

export class ReadableStaticVolume {
  constructor(sourcePath, realFsRoot) {
    this.sourcePath = sourcePath;
    this.realFsRoot = realFsRoot;
    this.reset()
  }

  reset() {
    this.buf = Buffer.alloc(1024 * 16);
    this.directoriesIndex = {};
    this.fd = -1;
    this.hash = '';
    this.intBuffer = Buffer.alloc(INTSIZE);
    this.index = {};
    this.statData = {};
  }

  load() {
    if (this.fd >= 0) {
      return;
    }

    // clone the original static fs values and set some defaults
    this.statData = {
      ...fs.statSync(this.sourcePath),
      isDirectory: () => false,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFile: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      size: 0
    };

    // read the index
    this.fd = fs.openSync(this.sourcePath, 'r');
    // close on process exit.
    let dataOffset = this.readInt();

    // read hash
    let hashSize = this.readInt();
    if (hashSize > this.buf.length) {
      this.buf = Buffer.alloc(hashSize);
    }
    this.readBuffer(this.buf, hashSize);
    this.hash = this.buf.toString('utf8', 0, hashSize);

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

      // add entry for file into index
      this.index[name] = Object.assign(
        {},
        this.statData,
        {
          ino: dataOffset, // the location in the static fs
          size: dataSz,    // the size of the file
          blocks: 1,       // one block
          blksize: dataSz, // of file size size.
          isFile: () => true, // it's a file!
        }
      );

      // ensure parent path has a directory entry
      this.addParentFolders(name);

      // build our directories index
      this.updateDirectoriesIndex(name);

      dataOffset += dataSz;
    } while (true)
  }

  readBuffer(buffer, length) {
    return fs.readSync(this.fd, buffer, 0, length || buffer.length, null);
  }

  readInt() {
    fs.readSync(this.fd, this.intBuffer, 0, INTSIZE, null);
    return this.intBuffer.readIntBE(0, 6);
  }

  shutdown() {
    fs.closeSync(this.fd);
    this.reset();
  }

  addParentFolders(name) {
    const parent = dirname(name);
    if (parent && !this.index[parent]) {
      this.index[parent] = Object.assign(
        {},
        this.statData,
        { isDirectory: () => true }
      );

      return this.addParentFolders(parent);
    }
  }

  updateDirectoriesIndex(name) {
    if (!this.index[name] || unixifyPath(name) === '/') {
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
}
