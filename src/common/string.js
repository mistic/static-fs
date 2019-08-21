export function stripBOM(content) {
  return content && content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}
