import { dirname, relative, resolve, sep } from 'path';
import { calculateHash, close, INT_SIZE, mkdir, open, readdir, readFile, stat, write } from '../../common';

export class WritableStaticVolume {
  constructor(mountingRoot) {
    this.mountingRoot = mountingRoot;
    this.outputFile = resolve(this.mountingRoot, 'static_fs/static_fs_volume.sfsv');
    this.reset();
  }

  reset() {
    this.hash = '';
    this.hashBuffer = Buffer.allocUnsafe(0);
    this.index = [];
    this.directoriesIndex = {};
    this.intBuffer = Buffer.alloc(INT_SIZE);
  }

  async addFolder(sourceFolder, exclusions) {
    if (this.mountingRoot === sourceFolder) {
      throw new Error('You cannot add the mounting root of the project to the static filesystem');
    }

    if (!sourceFolder.includes(this.mountingRoot)) {
      throw new Error(
        `All the files to include into the static filesystem should has mountingRoot has parent: ${this.mountingRoot}`,
      );
    }

    const calculatedTargetFolder = relative(this.mountingRoot, sourceFolder);
    await this.getFileNames(sourceFolder, calculatedTargetFolder, exclusions);
  }

  get headerLength() {
    let size = INT_SIZE; // start of data

    // put hash size in header
    this.hashBuffer = Buffer.from(this.hash, 'utf-8');

    size += INT_SIZE;
    size += this.hashBuffer.byteLength;

    const filePaths = Object.keys(this.index);
    for (const each in filePaths) {
      size += INT_SIZE; // name size
      size += INT_SIZE; // data size

      const filenameBuffer = Buffer.from(each, 'utf-8');
      this.index[each].filename = filenameBuffer;
      size += filenameBuffer.byteLength; // name itself.
    }

    size += INT_SIZE; // trailing zero.
    return size;
  }

  writeInt(fd, value, position) {
    this.intBuffer.writeIntBE(value, 0, 6);
    return write(fd, this.intBuffer, 0, INT_SIZE, position);
  }

  async write() {
    await mkdir(dirname(this.outputFile));
    this.hash = calculateHash(this.index);
    let dataOffset = this.headerLength;
    const fd = await open(this.outputFile, 'w');
    let headerPosition = await this.writeInt(fd, dataOffset);

    headerPosition += await this.writeInt(fd, this.hashBuffer.byteLength);
    headerPosition += await write(fd, this.hashBuffer, 0, this.hashBuffer.byteLength, headerPosition);

    const all = [];
    const filePaths = Object.keys(this.index);

    // start writing out the data
    for (const each in filePaths) {
      const entry = this.index[each];
      const position = dataOffset;
      dataOffset += entry.size;
      const buf = await this.index[each].getBuffer();
      await write(fd, buf, 0, buf.length, position);
    }

    // finish writing all the buffers.
    await Promise.all(all);

    // write the header
    for (const each in filePaths) {
      const entry = this.index[each];
      headerPosition += await this.writeInt(fd, entry.filename.length, headerPosition);
      headerPosition += await this.writeInt(fd, entry.size, headerPosition);
      headerPosition += await write(fd, entry.filename, 0, entry.filename.length, headerPosition);
    }

    await close(fd);
    return this.hash;
  }

  async getFileNames(sourceFolder, targetFolder, exclusions) {
    const files = await readdir(sourceFolder);
    const all = [];

    for (const file of files) {
      // compute the path names
      const sourcePath = `${sourceFolder}${sep}${file}`;
      const targetPath = `${targetFolder}${sep}${file}`;

      // is declared exclusion?
      const foundExclusion = exclusions[sourceFolder] || exclusions[sourcePath];
      if (foundExclusion) {
        continue;
      }

      // is this a directory
      const ss = await stat(sourcePath);
      if (ss.isDirectory()) {
        this.directoriesIndex[sourcePath] = {
          hasNativeModules: false,
        };

        all.push(this.getFileNames(sourcePath, targetPath, exclusions));
        continue;
      }

      const isNativeModuleFile = file.endsWith('.node');
      if (isNativeModuleFile) {
        this.directoriesIndex[sourcePath] = {
          hasNativeModules: true,
        };
        continue;
      }

      // it's a file. capture the details.
      this.index[targetPath] = {
        size: ss.size,
        getBuffer: () => readFile(sourcePath),
      };
    }
    // wait for children to finish
    await Promise.all(all);
  }

  getAddedFilesAndFolders() {
    const addParentsForFolder = (folderPath, accum) => {
      const parent = dirname(folderPath);
      if (parent && parent !== this.mountingRoot && parent.includes(this.mountingRoot)) {
        accum[parent] = true;
        return addParentsForFolder(parent, accum);
      }
    };

    const foldersWithNativeModulesIndex = Object.keys(this.directoriesIndex).reduce((accum, folderPath) => {
      if (this.directoriesIndex[folderPath].hasNativeModules && !accum[folderPath]) {
        accum[folderPath] = true;
        addParentsForFolder(folderPath, accum);
      }

      return accum;
    }, {});

    const addedFolders = Object.keys(this.directoriesIndex)
      .filter((folderPath) => !foldersWithNativeModulesIndex[folderPath])
      .map((folderPath) => resolve(this.mountingRoot, folderPath));

    const addedFiles = Object.keys(this.index).map((filePath) => resolve(this.mountingRoot, filePath));

    return addedFiles.concat(addedFolders).sort((a, b) => b.localeCompare(a));
  }
}
