import { createHash } from 'crypto';

export function calculateHash(content) {
  return createHash('sha256')
    .update(JSON.stringify(content))
    .digest('base64');
}
