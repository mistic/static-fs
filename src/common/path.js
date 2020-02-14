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
