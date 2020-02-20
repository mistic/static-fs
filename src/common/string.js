export function stripBOM(content) {
  return content && content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function strToEncoding(str, encoding = 'utf8') {
  if (encoding === 'utf8') return str;
  if (encoding === 'buffer') return new Buffer(str);
  return Buffer.from(str).toString(encoding);
}
