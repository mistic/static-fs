import { createHash } from 'crypto';

export const isWindows = process.platform === 'win32';

import { dirname, normalize, join, basename, extname } from 'path';
import { spawn } from 'child_process';

import * as filesystem from 'fs';

// shallow copy original function implementations before we start tweaking.
const fs = { ...filesystem };

// promisify async functions.
export function readdir(path) {
  return new Promise((r, j) => fs.readdir(path, (err, files) => err ? j(err) : r(files)));
}
export function stat(path) {
  return new Promise((r, j) => fs.stat(path, (err, files) => err ? j(err) : r(files)));
}
export function lstat(path) {
  return new Promise((r, j) => fs.lstat(path, (err, files) => err ? j(err) : r(files)));
}
export function open(path, flags, mode) {
  return new Promise((r, j) => fs.open(path, flags, mode, (err, descriptor) => err ? j(err) : r(descriptor)));
}
export function close(fd) {
  return new Promise((r, j) => fs.close(fd, (err) => err ? j(err) : r()));
}
export function write(fd, buffer, offset, length, position) {
  return new Promise((r, j) => fs.write(fd, buffer, offset || 0, length || buffer.length, position || undefined, (err, written, buf) => err ? j(err) : r(written)));
}
export function read(fd, buffer, offset, length, position) {
  return new Promise((r, j) => fs.read(fd, buffer, offset, length, position || null, (err, bytes, buffer) => err ? j(err) : r(bytes)));
}
export function readFile(path, options) {
  return new Promise((r, j) => fs.readFile(path, options, (err, data) => err ? j(err) : r(data)));
}
export function execute(command, cmdlineargs, options) {
  return new Promise((r, j) => {
    const cp = spawn(command, cmdlineargs, { ...options, stdio: "pipe" });
    let err = "";
    let out = "";
    cp.stderr.on("data", (chunk) => { err += chunk; process.stdout.write('.'); });
    cp.stdout.on("data", (chunk) => { out += chunk; process.stdout.write('.'); });
    cp.on("close", (code, signal) => r({ stdout: out, stderr: err, error: code ? new Error("Process Failed.") : null, code: code }));
  });
}
function fs_mkdir(path) {
  return new Promise((r, j) => fs.mkdir(path, (err) => err ? j(err) : r()))
}

function fs_unlink(path) {
  return new Promise((r, j) => fs.unlink(path, (err) => err ? j(err) : r()))
}

function fs_rmdir(path) {
  return new Promise((r, j) => fs.rmdir(path, (err) => err ? j(err) : r()))
}

export function rename(oldPath, newPath) {
  return new Promise((r, j) => fs.rename(oldPath, newPath, (err) => err ? j(err) : r()))
}
export function writeFile(filename, content) {
  return new Promise((r, j) => fs.writeFile(filename, content, (err) => err ? j(err) : r()))
}

export async function copyFile(source, target) {
  await mkdir(dirname(target));

  return await new Promise((resolve, reject) => {
    var rd = fs.createReadStream(source);
    rd.on('error', rejectCleanup);

    var wr = fs.createWriteStream(target);
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

export async function copyFolder(source, target, all) {
  const waitAtEnd = !all;
  all = all || [];

  if (isDirectory(source)) {
    for (const each of await readdir(source)) {
      const sp = join(source, each);
      const dp = join(target, each);

      if (await isDirectory(sp)) {
        copyFolder(sp, dp, all);
      } else {
        all.push(copyFile(sp, dp));
      }
    }
  }
  if (waitAtEnd) {
    await Promise.all(all);
  }
}

export const exists = path => new Promise((r, j) => fs.stat(path, (err, stats) => err ? r(false) : r(true)));

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

export async function rmdir(dirPath) {
  // if it's not there, do nothing.
  if (!await exists(dirPath)) {
    return;
  }

  //if it's not a directory, that's bad.
  if (!await isDirectory(dirPath)) {
    throw new Error(dirPath);
  }

  // make sure this isn't the current directory.
  if (process.cwd() === normalize(dirPath)) {
    process.chdir(`${dirPath}/..`);
  }

  // make sure the folder is empty first.
  const files = await readdir(dirPath);
  if (files.length) {
    const awaiter = [];
    try {
      for (const file of files) {
        try {
          const p = join(dirPath, file);

          if (await isDirectory(p)) {
            // folders are recursively rmdir'd 
            awaiter.push(rmdir(p));
          }
          else {
            // files and symlinks are unlink'd 
            awaiter.push(fs_unlink(p).catch(() => { }));
          }
        } catch (e) {
          // uh... can't.. ok.
        }

      }
    } finally {
      // after all the entries are done
      await Promise.all(awaiter);
    }
  }
  try {
    // if this fails for some reason, check if it's important.
    await fs_rmdir(dirPath);
  } catch (e) {
    // is it gone? that's all we really care about.
    if (await isDirectory(dirPath)) {
      // directory did not delete
      throw new Error(`UnableToRemoveException ${dirPath}`);
    }
  }
}

export async function rmFile(filePath) {
  // not there? no problem
  if (!exists(filePath)) {
    return;
  }

  // not a file? that's not cool.
  if (await isDirectory(filePath)) {
    throw new Error(`PathIsNotFileException : ${filePath}`);
  }

  try {
    // files and symlinks are unlink'd 
    await fs_unlink(filePath);
  } catch (e) {
    // is it gone? that's all we really care about.
    if (await exists(filePath)) {
      // directory did not delete
      throw new Error(`UnableToRemoveException : filePath`);
    }
  }
}


export async function mkdir(dirPath) {
  if (!await isDirectory(dirPath)) {
    const p = normalize(dirPath + "/");
    const parent = dirname(dirPath);
    if (! await isDirectory(parent)) {
      if (p !== parent) {
        await mkdir(parent);
      }
    }
    try {
      await fs_mkdir(p);
    } catch (e) {
      if (!await isDirectory(p)) {
        throw new Error(e);
      }
    }
  }
}

// size of integers in file. (node uses 6-byte integers in buffer.)
export const INTSIZE = 6;

/** Strips down a path into an absolute-style unix path (WIN32 only) */
export function unixifyPath(filepath) {
  if (!isWindows) return filepath;

  if (filepath && typeof filepath === 'string') {
    return filepath.
      // change \\?\<letter>:\ to <letter>:\ 
      replace(/^\\\\\?\\(.):\\/, '$1:\\').

      // change backslashes to forward slashes. (and remove duplicates)
      replace(/[\\\/]+/g, '/').

      // remove drive letter from front
      replace(/^([a-zA-Z]+:|\.\/)/, '').

      // drop any trailing slash
      replace(/(.+?)\/$/, '$1');
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
      var code = filepath.charCodeAt(0);
      return code >= 65 && code <= 90 || code >= 97 && code <= 122;
    }
  }
  return false;
}

export function calculateHash(content) {
  return createHash('sha256')
    .update(JSON.stringify(content))
    .digest('base64');
}

export function select(array, callbackFn) {
  return array.reduce(
    (p, c, i, a) => {
      p.push(callbackFn(p, c, i, a));
      return p;
    },
    []
  );
}

export function selectMany(array, callbackFn) {
  return array.reduce(
    (p, c, i, a) => {
      p.push(...callbackFn(p, c, i, a));
      return p;
    },
    []
  );
}

export function first(array, selector, onError) {
  for (const each of array) {
    const result = selector(each);
    if (result !== undefined) {
      return result
    }
  }
  return onError();
}


export async function backup(filename) {
  if (!await isFile(filename)) {
    // file doesn't exists, doesn't need restoring.
    return async () => {
      await rmFile(filename);
    };
  }
  const backupFile = join(dirname(filename), `${basename(filename)}.${Math.random() * 10000}${extname(filename)}`);

  // rename then copy preserves the file attributes when we restore.
  await rename(filename, backupFile);
  await copyFile(backupFile, filename);

  return async () => {
    await rmFile(filename);
    await rename(backupFile, filename);
  }
}
