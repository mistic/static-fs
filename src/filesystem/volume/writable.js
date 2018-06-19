import { relative } from 'path';
import { readdir, stat, open, close, write, readFile, INTSIZE, calculateHash } from '../../common';

export class WritableStaticVolume {
  constructor(realFsRoot) {
    this.realFsRoot = realFsRoot;
    this.reset();
  }

  reset() {
    this.hash = '';
    this.hashBuffer = Buffer.allocUnsafe(0);
    this.index = [];
    this.intBuffer = Buffer.alloc(INTSIZE);
  }

  async addFolder(sourceFolder) {
    if (this.realFsRoot === sourceFolder) {
      throw new Error('You cannot add the root of the project to the static filesystem');
    }

    if (!sourceFolder.includes(this.realFsRoot)) {
      throw new Error(`All the files to include into the static filesystem should come from inside the root of the project ${this.realFsRoot}`);
    }

    const calculatedTargetFolder = relative(this.realFsRoot, sourceFolder);
    await this.getFileNames(sourceFolder, calculatedTargetFolder);
  }

  get headerLength() {
    let size = INTSIZE; // start of data

    // put hash size in header
    this.hashBuffer = Buffer.from(this.hash, 'utf-8');

    size += INTSIZE;
    size += this.hashBuffer.byteLength;

    for (const each in this.index) {
      size += INTSIZE; // name size
      size += INTSIZE; // data size

      const filenameBuffer = Buffer.from(each, 'utf-8');
      this.index[each].filename = filenameBuffer;
      size += filenameBuffer.byteLength; // name itself.
    }
    size += INTSIZE; // trailing zero.
    return size;
  }

  writeInt(fd, value, position) {
    this.intBuffer.writeIntBE(value, 0, 6);
    return write(fd, this.intBuffer, 0, INTSIZE, position);
  }

  async write(outputPath, hash = calculateHash(this.index)) {
    this.hash = hash;
    let dataOffset = this.headerLength;
    const fd = await open(outputPath, 'w');
    let headerPosition = await this.writeInt(fd, dataOffset);

    headerPosition += await this.writeInt(fd, this.hashBuffer.byteLength);
    headerPosition += await write(fd, this.hashBuffer, 0, this.hashBuffer.byteLength, headerPosition);

    const all = [];

    // start writing out the data
    for (const each in this.index) {
      const entry = this.index[each];
      const position = dataOffset;
      dataOffset += entry.size;
      const buf = await this.index[each].getBuffer();
      await write(fd, buf, 0, buf.length, position);
    }

    // finish writing all the buffers.
    await Promise.all(all);

    // write the header
    for (const each in this.index) {
      const entry = this.index[each];
      headerPosition += await this.writeInt(fd, entry.filename.length, headerPosition);
      headerPosition += await this.writeInt(fd, entry.size, headerPosition);
      headerPosition += await write(fd, entry.filename, 0, entry.filename.length, headerPosition);
    }

    await close(fd);
    return hash;
  }

  async getFileNames(sourceFolder, targetFolder) {
    const files = await readdir(sourceFolder);
    const all = [];

    for (const file of files) {
      // compute the path names
      const sourcePath = `${sourceFolder}/${file}`;
      const targetPath = `${targetFolder}/${file}`;

      // is this a directory
      const ss = await stat(sourcePath);
      if (ss.isDirectory()) {
        all.push(this.getFileNames(sourcePath, targetPath));
      } else {
        // it's a file. capture the details.
        this.index[targetPath] = {
          size: ss.size,
          getBuffer: () => readFile(sourcePath)
        }
      }
    }
    // wait for children to finish
    await Promise.all(all);
  }
}
