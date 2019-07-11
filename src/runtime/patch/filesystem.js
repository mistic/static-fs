import fs from 'fs';

const MemberType = {
  Constructor: 0,
  Method: 1,
  Property: 2
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
};

export function patchFilesystem(volume, original = fs) {

  // create a backup before modification
  const backup = { ...original };

  // iterate over the filesystem and patch members
  for (const member of Object.getOwnPropertyNames(original)) {
    if (!volume[member] || typeof volume[member] !== typeof original[member]) {
      continue;
    }

    switch (metadata[member]) {
      case MemberType.Constructor:
        // bind as a constructor
        original[member] = volume[member].bind(null, volume);
        break;

      case MemberType.Property:
        // overwrite property
        original[member] = volume[member];
        break;

      default:
        // bind as a method
        original[member] = volume[member].bind(volume);
        break
    }
  }

  // return a delegate to undo those changes.
  return () => patchFilesystem(fs, backup);
}
