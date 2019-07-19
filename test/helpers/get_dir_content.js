import { readdirSync, statSync } from 'fs';
import { sep } from 'path';

export function getDirContent(path) {
  return _getDirContent(path);
}

function _getDirContent(path, result = []) {
  for (const each of readdirSync(path)) {
    if (statSync(`${path}${sep}${each}`).isDirectory()) {
      _getDirContent(`${path}${sep}${each}`, result)
    } else {
      result.push(`${path}${sep}${each}`)
    }
  }

  return result;
}
