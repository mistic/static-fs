import { basename, dirname, relative, resolve, sep } from 'path';
import { calculateHash, close, INT_SIZE, mkdir, open, readdir, readFile, stat, write, writeFile } from '../../common';

export class WritableStaticVolume {
  constructor(mountingRoot) {
    this.mountingRoot = mountingRoot;
    this.indexFile = resolve(this.mountingRoot, 'static_fs/static_fs_index.json');
    this.manifestFile = resolve(this.mountingRoot, 'static_fs/static_fs_manifest.json');
    this.outputFile = resolve(this.mountingRoot, 'static_fs/static_fs_volume.sfsv');
    this.reset();
  }

  reset() {
    this.directoriesIndex = {};
    this.hash = '';
    this.hashBuffer = Buffer.allocUnsafe(0);
    this.filesIndex = {};
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
    const isFolder = (await stat(sourceFolder)).isDirectory();
    if (!isFolder) {
      throw new Error(`The given path ${sourceFolder} is not a folder.`);
    }

    // mark folder without native modules by default
    // it would be updated in the next walk update function
    this.directoriesIndex[calculatedTargetFolder] = {
      hasNativeModules: false,
      content: new Set(),
    };

    await this.getFileNames(sourceFolder, calculatedTargetFolder, exclusions);
  }

  get headerLength() {
    // put hash size in header
    this.hashBuffer = Buffer.from(this.hash, 'utf-8');

    let size = INT_SIZE;
    size += this.hashBuffer.byteLength;

    size += INT_SIZE; // trailing zero.
    return size;
  }

  writeInt(fd, value, position) {
    this.intBuffer.writeIntBE(value, 0, 6);
    return write(fd, this.intBuffer, 0, INT_SIZE, position);
  }

  async write() {
    await mkdir(dirname(this.outputFile));
    this.hash = calculateHash(Object.keys(this.filesIndex).sort());

    // write the main volume
    await this.writeVolume();

    // write the index file
    await this.writeIndex();

    // write the manifest file
    await this.writeManifest();

    return this.hash;
  }

  async writeIndex() {
    const directoriesIndex = Object.keys(this.directoriesIndex).reduce((dirsIdx, dirPath) => {
      dirsIdx[dirPath] = Array.from(this.directoriesIndex[dirPath].content.values());
      return dirsIdx;
    }, {});

    let totalDataSize = this.headerLength;
    const filesIndex = Object.keys(this.filesIndex).reduce((filesIdx, filePath) => {
      filesIdx[filePath] = {
        ino: totalDataSize,
        size: this.filesIndex[filePath].size,
      };

      totalDataSize += this.filesIndex[filePath].size;
      return filesIdx;
    }, {});

    const volumeStats = await stat(this.outputFile);

    await writeFile(
      this.indexFile,
      JSON.stringify({
        directoriesIndex,
        filesIndex,
        volumeStats,
      }),
    );
  }

  async writeVolume() {
    const volumeFd = await open(this.outputFile, 'w');
    let dataOffset = this.headerLength;

    let headerPosition = await this.writeInt(volumeFd, this.hashBuffer.byteLength);
    await write(volumeFd, this.hashBuffer, 0, this.hashBuffer.byteLength, headerPosition);

    const all = [];
    const filePaths = Object.keys(this.filesIndex);

    // start writing out the data
    for (const each of filePaths) {
      const entry = this.filesIndex[each];
      const position = dataOffset;
      dataOffset += entry.size;
      const buf = await this.filesIndex[each].getBuffer();
      await write(volumeFd, buf, 0, buf.length, position);
    }

    // finish writing all the buffers.
    await Promise.all(all);

    await close(volumeFd);
  }

  async writeManifest() {
    // gather useful info
    const manifestContent = {
      manifest: basename(this.manifestFile),
      mountingRoot: this.mountingRoot,
      hash: this.hash,
      volume: this.outputFile,
      directories: Object.keys(this.directoriesIndex).sort(),
      files: Object.keys(this.filesIndex).sort(),
    };

    await writeFile(this.manifestFile, JSON.stringify(manifestContent, null, 2));
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
        this.directoriesIndex[targetPath] = {
          hasNativeModules: false,
          content: new Set(),
        };

        all.push(this.getFileNames(sourcePath, targetPath, exclusions));
        continue;
      }

      // add native module metadata to folders index
      const isNativeModuleFile = file.endsWith('.node');
      if (isNativeModuleFile) {
        this.directoriesIndex[targetFolder].hasNativeModules = true;
        continue;
      }

      // adds file to the content
      this.directoriesIndex[targetFolder].content.add(file);

      // it's a file. capture the details.
      this.filesIndex[targetPath] = {
        size: ss.size,
        getBuffer: () => readFile(sourcePath),
      };
    }
    // wait for children to finish
    await Promise.all(all);
  }

  getAddedFilesAndFolders() {
    // Recursive help function to build the parent
    // hierarchy for a given folder
    const addParentsForFolder = (folderPath, accum) => {
      const calculatedParent = dirname(resolve(this.mountingRoot, folderPath));
      const parent = dirname(folderPath);
      if (calculatedParent && calculatedParent !== this.mountingRoot && calculatedParent.includes(this.mountingRoot)) {
        accum[parent] = true;
        return addParentsForFolder(parent, accum);
      }
    };

    // Get the base folders with native modules files on it
    // and build the complete path with parents
    const foldersWithNativeModulesIndex = Object.keys(this.directoriesIndex).reduce((accum, folderPath) => {
      if (this.directoriesIndex[folderPath].hasNativeModules && !accum[folderPath]) {
        accum[folderPath] = true;
        addParentsForFolder(folderPath, accum);
      }

      return accum;
    }, {});

    // To the entire list of added folders
    // remove the entire hierarchy for the ones
    // with native modules
    const addedFolders = Object.keys(this.directoriesIndex)
      .filter((folderPath) => !foldersWithNativeModulesIndex[folderPath])
      .map((folderPath) => resolve(this.mountingRoot, folderPath));

    const addedFiles = Object.keys(this.filesIndex).map((filePath) => resolve(this.mountingRoot, filePath));

    // Finally return the curated list of filtered folders
    // and added files
    return addedFiles.concat(addedFolders).sort((a, b) => b.localeCompare(a));
  }
}
