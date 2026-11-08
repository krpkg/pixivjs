export class PixivError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'PIXIV_ERROR', status?: number) {
    super(message);
    this.name = 'PixivError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PixivValidationError extends PixivError {
  constructor(message: string) {
    super(message, 'ERR_VALIDATION');
    this.name = 'PixivValidationError';
  }
}

export class PixivNotFoundError extends PixivError {
  constructor(illustId: string | number) {
    super(`Artwork ${illustId} not found or has been deleted.`, 'ERR_NOT_FOUND', 404);
    this.name = 'PixivNotFoundError';
  }
}

export class PixivRateLimitError extends PixivError {
  constructor(message = 'Pixiv API rate limit exceeded (429 Too Many Requests).') {
    super(message, 'ERR_RATE_LIMIT', 429);
    this.name = 'PixivRateLimitError';
  }
}

export class PixivAuthError extends PixivError {
  constructor(message = 'Pixiv authentication failed or access forbidden (403 Forbidden).') {
    super(message, 'ERR_AUTH_FORBIDDEN', 403);
    this.name = 'PixivAuthError';
  }
}

export class PixivApiError extends PixivError {
  constructor(message: string, status?: number) {
    super(message, 'ERR_API', status);
    this.name = 'PixivApiError';
  }
}

export class PixivDownloadError extends PixivError {
  constructor(message: string) {
    super(message, 'ERR_DOWNLOAD');
    this.name = 'PixivDownloadError';
  }
}
