import * as realFs from 'fs';
import * as util from 'util';
import { createPatchedFs } from './fs';

const MemberType = {
  Constructor: 0,
  Property: 1,
  PromisesApi: 2,
};

const metadata = {
  StatWatcher: MemberType.Constructor,
  FSWatcher: MemberType.Constructor,
  ReadStream: MemberType.Constructor,
  WriteStream: MemberType.Constructor,
  ReadFileStream: MemberType.Constructor,
  WriteFileStream: MemberType.Constructor,
  Stats: MemberType.Constructor,

  constants: MemberType.Property,
  F_OK: MemberType.Property,
  R_OK: MemberType.Property,
  W_OK: MemberType.Property,
  X_OK: MemberType.Property,

  promises: MemberType.PromisesApi
};

function applyPatchFs(patchedFs, originalFs) {
  // create a backup before modification
  const backupFs = { ...originalFs };

  // iterate over the filesystem and patch members
  for (const member of Object.getOwnPropertyNames(originalFs)) {
    if (!patchedFs[member] || typeof patchedFs[member] !== typeof originalFs[member]) {
      continue;
    }

    switch (metadata[member]) {
      case MemberType.Constructor:
        // bind as a constructor
        originalFs[member] = patchedFs[member].bind(null, patchedFs);
        break;

      case MemberType.Property:
        // skip overwrite property
        break;

      case MemberType.PromisesApi:
        // patch promises
        applyPatchFsPromises(patchedFs, originalFs);
        break;

      default:
        // bind as a method
        originalFs[member] = patchedFs[member].bind(patchedFs);
        break;
    }
  }

  // return a delegate to undo those changes.
  return () => applyPatchFs(backupFs, originalFs);
}

function applyPatchFsPromises(patchedFs, originalFs) {
  // patch promises
  const originalPromises = originalFs.promises;
  const patchedPromises = patchedFs.promises;

  for (const pMember of Object.getOwnPropertyNames(originalPromises)) {
    if (!patchedPromises[pMember] || typeof patchedPromises[pMember] !== typeof originalPromises[pMember]) {
      continue;
    }

    // bind all as method
    originalPromises[pMember] = patchedPromises[pMember].bind(patchedPromises);
  }
}

function createCustomNodeJsSymbolsForFs(patchedFs) {
  Object.defineProperty(patchedFs.exists, util.promisify.custom, {
    value: (path) => {
      return new Promise((resolve) => patchedFs.exists(path, resolve));
    },
  });
}

export function patchFilesystem(sfsRuntime) {
  const patchedFs = createPatchedFs(sfsRuntime, realFs);
  const undoPatchFs = applyPatchFs(patchedFs, realFs);

  // NOTE: After patching the fs we should apply some custom symbols
  // that nodeJS applies by itself to be used for example on util.promisify
  // As an example we can check the definition of custom symbols on
  // exists function : https://github.com/nodejs/node/blob/v10.x/lib/fs.js
  createCustomNodeJsSymbolsForFs(patchedFs);

  return undoPatchFs;
}
