import { createHash } from 'crypto';
import { dirname, normalize } from 'path';

import * as filesystem from 'fs';

// shallow copy original function implementations before we start tweaking.
const fs = { ...filesystem };

export const isWindows = process.platform === 'win32';

// size of integers in file. (node uses 6-byte integers in buffer.)
export const INT_SIZE = 6;

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

// Strips down a path into an absolute-style unix path
export function unixifyPath(filepath) {
  if (!isWindows) return filepath;

  if (filepath && typeof filepath === 'string') {
    return (
      filepath
        // change \\?\<letter>:\ to <letter>:\
        .replace(/^\\\\\?\\(.):\\/, '$1:\\')
        // change backslashes to forward slashes. (and remove duplicates)
        // eslint-disable-next-line no-useless-escape
        .replace(/[\\\/]+/g, '/')
        // remove drive letter from front
        .replace(/^([a-zA-Z]+:|\.\/)/, '')
        // drop any trailing slash
        .replace(/(.+?)\/$/, '$1')
    );
  }
  return filepath;
}

export function isWindowsPath(filepath) {
  if (!isWindows) return filepath;

  if (filepath && filepath.length >= 3) {
    if (filepath.charCodeAt(0) === 92 && filepath.charCodeAt(1) === 92) {
      return true;
    }

    if (filepath.charCodeAt(1) === 58 && filepath.charCodeAt(2) === 92) {
      const code = filepath.charCodeAt(0);
      return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    }
  }
  return false;
}

export function calculateHash(content) {
  return createHash('sha256')
    .update(JSON.stringify(content))
    .digest('base64');
}
