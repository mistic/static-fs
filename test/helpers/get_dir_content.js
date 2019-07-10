import fs from 'fs';

export function getDirContent(path) {
  return _getDirContent(path);
}

function _getDirContent(path, result = []) {
  for (const each of fs.readdirSync(path)) {
    if (fs.statSync(`${path}/${each}`).isDirectory()) {
      _getDirContent(`${path}/${each}`, result)
    } else {
      result.push(`${path}/${each}`)
    }
  }

  return result;
}
