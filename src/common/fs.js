import * as filesystem from 'fs';
import { dirname, normalize } from 'path';

// shallow copy original function implementations before we start tweaking.
const fs = { ...filesystem };

// promisify async functions.
export function readdir(path) {
  return new Promise((r, j) => fs.readdir(path, (err, files) => (err ? j(err) : r(files))));
}
export function stat(path) {
  return new Promise((r, j) => fs.stat(path, (err, files) => (err ? j(err) : r(files))));
}
export function lstat(path) {
  return new Promise((r, j) => fs.lstat(path, (err, files) => (err ? j(err) : r(files))));
}
export function open(path, flags, mode) {
  return new Promise((r, j) => fs.open(path, flags, mode, (err, descriptor) => (err ? j(err) : r(descriptor))));
}
export function close(fd) {
  return new Promise((r, j) => fs.close(fd, (err) => (err ? j(err) : r())));
}
export function write(fd, buffer, offset, length, position) {
  return new Promise((r, j) =>
    fs.write(fd, buffer, offset || 0, length || buffer.length, position || undefined, (err, written) =>
      err ? j(err) : r(written),
    ),
  );
}
export function read(fd, buffer, offset, length, position) {
  return new Promise((r, j) =>
    fs.read(fd, buffer, offset, length, position || null, (err, bytes) => (err ? j(err) : r(bytes))),
  );
}
export function readFile(path, options) {
  return new Promise((r, j) => fs.readFile(path, options, (err, data) => (err ? j(err) : r(data))));
}

function fs_mkdir(path) {
  return new Promise((r, j) => fs.mkdir(path, (err) => (err ? j(err) : r())));
}

export function writeFile(filename, content) {
  return new Promise((r, j) => fs.writeFile(filename, content, (err) => (err ? j(err) : r())));
}

export async function copyFile(source, target) {
  await mkdir(dirname(target));

  return await new Promise((resolve, reject) => {
    const rd = fs.createReadStream(source);
    rd.on('error', rejectCleanup);

    const wr = fs.createWriteStream(target);
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

export const exists = (path) => new Promise((r) => fs.stat(path, (err) => (err ? r(false) : r(true))));

export async function isDirectory(dirPath) {
  try {
    if (await exists(dirPath)) {
      return (await lstat(dirPath)).isDirectory();
    }
  } catch (e) {
    // don't throw!
  }
  return false;
}

export async function isFile(filePath) {
  try {
    if (await exists(filePath)) {
      return !(await lstat(filePath)).isDirectory();
    }
  } catch (e) {
    // don't throw!
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
      await fs_mkdir(p);
    } catch (e) {
      if (!(await isDirectory(p))) {
        throw new Error(e);
      }
    }
  }
}
