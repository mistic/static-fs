import * as realFs from 'fs';
import { dirname, normalize } from 'path';
import { promisify } from 'util';

// promisified functions from the real fs
export async function close(fd) {
  return promisify(realFs.close)(fd);
}

export async function lstat(path) {
  return promisify(realFs.lstat)(path);
}

export async function open(path, flags, mode) {
  return promisify(realFs.open)(path, flags, mode);
}

export async function read(fd, buffer, offset, length, position) {
  return promisify(realFs.read)(fd, buffer, offset, length, position || null);
}

export async function readdir(path) {
  return promisify(realFs.readdir)(path);
}

export async function readFile(path, options) {
  return promisify(realFs.readFile)(path, options);
}

export async function stat(path) {
  return promisify(realFs.stat)(path);
}

export async function write(fd, buffer, offset, length, position) {
  return promisify(realFs.write)(fd, buffer, offset || 0, length || buffer.length, position || undefined);
}

export async function writeFile(filename, content) {
  return promisify(realFs.writeFile)(filename, content);
}

// custom functions
export async function copyFile(source, target) {
  await mkdir(dirname(target));

  return await new Promise((resolve, reject) => {
    const rd = realFs.createReadStream(source);
    rd.on('error', rejectCleanup);

    const wr = realFs.createWriteStream(target);
    wr.on('error', rejectCleanup);

    function rejectCleanup(err) {
      rd.destroy();
      wr.end();
      reject(err);
    }

    wr.on('finish', () => {
      rd.close();
      wr.close();
      resolve();
    });

    rd.pipe(wr);
  });
}

export async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    /* no-op */
  }
  return false;
}

export async function isDirectory(dirPath) {
  try {
    if (await exists(dirPath)) {
      return (await lstat(dirPath)).isDirectory();
    }
  } catch {
    /* no-op */
  }
  return false;
}

export async function isFile(filePath) {
  try {
    if (await exists(filePath)) {
      return !(await lstat(filePath)).isDirectory();
    }
  } catch {
    /* no-op */
  }

  return false;
}

export async function mkdir(dirPath) {
  if (!(await isDirectory(dirPath))) {
    const p = normalize(dirPath + '/');
    const parent = dirname(dirPath);
    if (!(await isDirectory(parent))) {
      if (p !== parent) {
        await mkdir(parent);
      }
    }
    try {
      await promisify(realFs.mkdir)(p);
    } catch (e) {
      if (!(await isDirectory(p))) {
        throw new Error(e);
      }
    }
  }
}
