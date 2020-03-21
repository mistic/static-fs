import { resolve } from 'path';
import { isWindows } from './constants';

// Strips down a path into an absolute-style unix path
export function unixifyPath(filePath) {
  if (!isWindows) return filePath;

  if (filePath && typeof filePath === 'string') {
    return (
      filePath
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
  return filePath;
}

export function isWindowsPath(filePath) {
  if (!isWindows) return filePath;

  if (filePath && filePath.length >= 3) {
    if (filePath.charCodeAt(0) === 92 && filePath.charCodeAt(1) === 92) {
      return true;
    }

    if (filePath.charCodeAt(1) === 58 && filePath.charCodeAt(2) === 92) {
      const code = filePath.charCodeAt(0);
      return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    }
  }
  return false;
}

// Unixify and resolve path
export function sanitizePath(...args) {
  return unixifyPath(resolve(...args));
}

function getPathFromURLPosix(url) {
  if (url.hostname !== '') {
    throw new Error(`file URL host must be "localhost" or empty on ${process.platform}`);
  }
  const pathname = url.pathname;
  for (let n = 0; n < pathname.length; n++) {
    if (pathname[n] === '%') {
      const third = pathname.codePointAt(n + 2) | 0x20;
      if (pathname[n + 1] === '2' && third === 102) {
        throw new Error(`file URL path must not include encoded / characters`);
      }
    }
  }
  return decodeURIComponent(pathname);
}

export function nodePathToString(path) {
  if (typeof path !== 'string' && !Buffer.isBuffer(path)) {
    if (!(path instanceof require('url').URL))
      throw new Error(`The "path" argument must be one of type string, Buffer, or URL. Received type ${typeof path}`);

    path = getPathFromURLPosix(path);
  }

  // in case it is a buffer convert
  const pathString = String(path);

  // null check
  if (('' + pathString).indexOf('\u0000') !== -1) {
    const er = new Error('path must be a string without null bytes');
    er.code = 'ENOENT';
    throw er;
  }

  return pathString;
}
