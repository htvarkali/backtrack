export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requiredText(value, label, max = 300) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, `${label} is required.`, 'INVALID_INPUT');
  }
  const text = value.trim();
  if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) {
    throw new AppError(400, `${label} must be at most ${max} characters.`, 'INVALID_INPUT');
  }
  return text;
}

export function normalized(value = '') {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/&/g, 'and')
    .replace(/\s+-\s+.*$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function sameRecording(a, b) {
  const artistA = normalized(a.artist);
  const artistB = normalized(b.artist);
  return normalized(a.title) === normalized(b.title) &&
    (artistA === artistB || artistA.startsWith(`${artistB} `) || artistB.startsWith(`${artistA} `));
}
