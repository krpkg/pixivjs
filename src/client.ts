import type {
  ArtworkData,
  ClientOptions,
  DownloadZipOptions,
  DownloadProgress,
  PixivPage,
  UgoiraMeta,
} from './types';
import { extractIllustId, isPixivCdnUrl, sanitizeFilename, sleep } from './utils';
import {
  PixivValidationError,
  PixivNotFoundError,
  PixivRateLimitError,
  PixivAuthError,
  PixivApiError,
  PixivDownloadError,
} from './errors';

export class PixivClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;
  private userAgent: string;
  private cookie?: string;
  private referer: string;
  private retries: number;
  private retryDelay: number;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'https://www.pixiv.net').replace(/\/+$/, '');
    this.fetchFn =
      options.fetch ||
      (typeof globalThis !== 'undefined' && globalThis.fetch
        ? globalThis.fetch.bind(globalThis)
        : fetch);
    this.userAgent =
      options.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    this.cookie = options.cookie;
    this.referer = options.referer || 'https://www.pixiv.net/';
    this.retries = options.retries ?? 0;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  /**
   * Internal header builder with Pixiv Referer & User-Agent
   */
  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Referer: this.referer,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      ...extra,
    };

    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    return headers;
  }

  /**
   * Internal fetch with retries for transient errors (429, 502, 503, 504, network drops)
   */
  private async request(
    url: string,
    options: RequestInit = {},
    customRetries = this.retries
  ): Promise<Response> {
    let attempts = 0;
    while (true) {
      try {
        const response = await this.fetchFn(url, options);

        // Check if rate limited or transient server error and retry if attempts remain
        if (
          (response.status === 429 || (response.status >= 500 && response.status <= 504)) &&
          attempts < customRetries
        ) {
          attempts++;
          await sleep(this.retryDelay * attempts);
          continue;
        }

        return response;
      } catch (err) {
        if (attempts < customRetries) {
          attempts++;
          await sleep(this.retryDelay * attempts);
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Fetches metadata for an artwork by URL, full link, or ID.
   */
  async getArtwork(input: string | number): Promise<ArtworkData> {
    const illustId = extractIllustId(input);
    if (!illustId) {
      throw new PixivValidationError(`Invalid Pixiv artwork ID or URL: "${input}"`);
    }

    const url = `${this.baseUrl}/ajax/illust/${illustId}`;
    const response = await this.request(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      throw new PixivNotFoundError(illustId);
    }
    if (response.status === 429) {
      throw new PixivRateLimitError();
    }
    if (response.status === 403) {
      throw new PixivAuthError();
    }
    if (!response.ok) {
      throw new PixivApiError(`Pixiv API responded with status ${response.status}`, response.status);
    }

    const json: any = await response.json();
    if (json.error) {
      throw new PixivApiError(
        json.message || `Failed to fetch artwork from Pixiv (ID: ${illustId})`,
        response.status
      );
    }

    const body = json.body;
    let pages: PixivPage[] = [];

    // 1. Try standard desktop pages endpoint
    try {
      const pagesUrl = `${this.baseUrl}/ajax/illust/${illustId}/pages`;
      const pagesRes = await this.request(pagesUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (pagesRes.ok) {
        const pagesJson: any = await pagesRes.json();
        if (!pagesJson.error && Array.isArray(pagesJson.body) && pagesJson.body.length > 0) {
          pages = pagesJson.body;
        }
      }
    } catch {
      // Desktop pages fetch failed, proceed to fallback
    }

    // 2. Check if desktop returned valid URLs or null (e.g. R-18 / age restricted)
    const desktopHasValidUrls =
      pages.length > 0 && pages[0]?.urls && (pages[0].urls.regular || pages[0].urls.original);

    if (!desktopHasValidUrls) {
      try {
        const touchUrl = `${this.baseUrl}/touch/ajax/illust/details?illust_id=${illustId}`;
        const touchRes = await this.request(touchUrl, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (touchRes.ok) {
          const touchJson: any = await touchRes.json();
          const touchIllust = touchJson?.body?.illust_details;

          if (touchIllust) {
            const pageCount = parseInt(touchIllust.page_count, 10) || 1;
            const origUrl =
              touchIllust.url_big ||
              touchIllust.url_original ||
              touchIllust.url_s ||
              touchIllust.url;

            if (origUrl) {
              pages = [];
              for (let i = 0; i < pageCount; i++) {
                const pageOrig = origUrl.replace(/_p\d+/, `_p${i}`);
                pages.push({
                  urls: {
                    thumb_mini: pageOrig,
                    small: pageOrig,
                    regular: pageOrig,
                    original: pageOrig,
                  },
                  width: parseInt(touchIllust.width, 10) || 0,
                  height: parseInt(touchIllust.height, 10) || 0,
                });
              }
            }
          }
        }
      } catch {
        // Fallback failed
      }
    }

    // 3. If single-page artwork has no pages array, build from body.urls
    if (pages.length === 0 && body.urls) {
      pages.push({
        urls: {
          thumb_mini: body.urls.mini || '',
          small: body.urls.small || '',
          regular: body.urls.regular || '',
          original: body.urls.original || '',
        },
        width: body.width,
        height: body.height,
      });
    }

    return {
      id: body.id,
      title: body.title,
      description: body.description,
      illustType: body.illustType,
      createDate: body.createDate,
      uploadDate: body.uploadDate,
      pageCount: body.pageCount,
      width: body.width,
      height: body.height,
      userName: body.userName,
      userId: body.userId,
      userAccount: body.userAccount,
      tags: body.tags?.tags || [],
      likeCount: body.likeCount,
      bookmarkCount: body.bookmarkCount,
      viewCount: body.viewCount,
      urls: body.urls || {},
      pages,
    };
  }

  /**
   * Fetches ugoira animation frames and metadata for an artwork.
   */
  async getUgoiraMeta(input: string | number): Promise<UgoiraMeta> {
    const illustId = extractIllustId(input);
    if (!illustId) {
      throw new PixivValidationError(`Invalid Pixiv artwork ID or URL: "${input}"`);
    }

    const url = `${this.baseUrl}/ajax/illust/${illustId}/ugoira_meta`;
    const response = await this.request(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      throw new PixivNotFoundError(illustId);
    }
    if (response.status === 429) {
      throw new PixivRateLimitError();
    }
    if (response.status === 403) {
      throw new PixivAuthError();
    }
    if (!response.ok) {
      throw new PixivApiError(`Pixiv API responded with status ${response.status}`, response.status);
    }

    const json: any = await response.json();
    if (json.error || !json.body) {
      throw new PixivApiError(
        json.message || `No ugoira metadata found for artwork ID ${illustId}`,
        response.status
      );
    }

    return {
      src: json.body.src,
      originalSrc: json.body.originalSrc,
      mime_type: json.body.mime_type,
      frames: json.body.frames || [],
    };
  }

  /**
   * Downloads an image from Pixiv CDN (i.pximg.net) with valid Referer headers.
   * Returns an ArrayBuffer and response metadata.
   */
  async fetchImage(imageUrl: string, signal?: AbortSignal): Promise<{ data: ArrayBuffer; contentType: string }> {
    if (!isPixivCdnUrl(imageUrl)) {
      throw new PixivValidationError(`Untrusted Pixiv CDN image URL: "${imageUrl}"`);
    }

    const response = await this.request(imageUrl, {
      method: 'GET',
      headers: this.getHeaders({
        Referer: this.referer,
      }),
      signal,
    });

    if (response.status === 429) {
      throw new PixivRateLimitError();
    }
    if (response.status === 403) {
      throw new PixivAuthError();
    }
    if (!response.ok) {
      throw new PixivApiError(`Failed to fetch image ${imageUrl}: HTTP ${response.status}`, response.status);
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return { data, contentType };
  }

  /**
   * Concurrently downloads all pages of an artwork and packages them into a ZIP archive.
   * Dynamically loads JSZip on demand to keep the base package footprint lightweight.
   */
  async downloadZip(
    artwork: ArtworkData,
    options: DownloadZipOptions = {}
  ): Promise<{ data: Uint8Array; filename: string }> {
    if (!artwork.pages || artwork.pages.length === 0) {
      throw new PixivDownloadError('Artwork contains no downloadable pages');
    }

    const concurrency = Math.max(1, options.concurrency ?? 3);
    const { onProgress, signal } = options;
    const total = artwork.pages.length;
    let completedDownloads = 0;

    const report = (stage: DownloadProgress['stage'], current: number, t: number) => {
      if (onProgress) {
        const percentage = t > 0 ? Math.round((current / t) * 100) : 0;
        onProgress({ stage, current, total: t, percentage });
      }
    };

    report('downloading', 0, total);

    // Concurrency queue
    const queue = [...artwork.pages.entries()];
    const downloadedPages: Array<{ index: number; buffer: ArrayBuffer; ext: string }> = [];

    const worker = async () => {
      while (queue.length > 0) {
        if (signal?.aborted) {
          throw new PixivDownloadError('Download aborted by user');
        }

        const item = queue.shift();
        if (!item) break;

        const [index, page] = item;
        const pageUrl = page.urls.original || page.urls.regular;
        if (!pageUrl) {
          completedDownloads++;
          report('downloading', completedDownloads, total);
          continue;
        }

        const ext = pageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const { data } = await this.fetchImage(pageUrl, signal);

        downloadedPages.push({ index, buffer: data, ext });
        completedDownloads++;
        report('downloading', completedDownloads, total);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);

    // Build ZIP
    report('compressing', 0, 100);
    
    // Dynamic import of jszip to keep standard client bundle lean
    const JSZipModule = await import('jszip');
    const JSZip = (JSZipModule.default || JSZipModule) as any;
    const zip = new JSZip();
    const safeTitle = sanitizeFilename(artwork.title);

    // Sort in original page order
    downloadedPages.sort((a, b) => a.index - b.index);

    for (const { index, buffer, ext } of downloadedPages) {
      const filename = `${artwork.id}_p${index}_${safeTitle}.${ext}`;
      zip.file(filename, buffer);
    }

    const zipContent = await zip.generateAsync(
      {
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadata: { percent: number }) => {
        report('compressing', Math.round(metadata.percent), 100);
      }
    );

    const filename = `${artwork.id}_${safeTitle}.zip`;
    return { data: zipContent, filename };
  }
}
