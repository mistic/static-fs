import rimraf from 'rimraf';
import { promisify } from 'util';

const asyncRimRaf = promisify(rimraf);

async function runRimRaf(file) {
  await asyncRimRaf(file, { glob: false });
}

export async function deleteFiles(filesToDelete) {
  if (!Array.isArray(filesToDelete)) {
    return;
  }

  for (const fileToDelete of filesToDelete) {
    await runRimRaf(fileToDelete);
  }
}
