import { resolve } from 'path';

export function getStaticFsPackage(mockProjectPath) {
  return require(resolve(mockProjectPath, 'node_modules/static-fs'));
}
