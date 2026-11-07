// src/utils.ts
function extractIllustId(input) {
  if (typeof input === "number") {
    return Number.isSafeInteger(input) && input > 0 ? String(input) : null;
  }
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const artworksMatch = trimmed.match(/artworks\/(\d+)/i);
  if (artworksMatch) {
    return artworksMatch[1];
  }
  const illustMatch = trimmed.match(/illust_id=(\d+)/i);
  if (illustMatch) {
    return illustMatch[1];
  }
  const fallbackDigits = trimmed.match(/https?:\/\/[^\s]+(\d{7,10})/);
  if (fallbackDigits) {
    return fallbackDigits[1];
  }
  return null;
}
function isPixivCdnUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && (parsed.hostname === "i.pximg.net" || parsed.hostname.endsWith(".pximg.net") || parsed.hostname === "pixiv.net" || parsed.hostname.endsWith(".pixiv.net"));
  } catch {
    return false;
  }
}
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "pixiv_artwork";
}

// src/client.ts
import JSZip from "jszip";
var PixivClient = class {
  baseUrl;
  fetchFn;
  userAgent;
  cookie;
  referer;
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || "https://www.pixiv.net").replace(/\/+$/, "");
    this.fetchFn = options.fetch || (typeof globalThis !== "undefined" && globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
    this.userAgent = options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    this.cookie = options.cookie;
    this.referer = options.referer || "https://www.pixiv.net/";
  }
  /**
   * Internal header builder with Pixiv Referer & User-Agent
   */
  getHeaders(extra) {
    const headers = {
      "User-Agent": this.userAgent,
      Referer: this.referer,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
      ...extra
    };
    if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }
    return headers;
  }
  /**
   * Fetches metadata for an artwork by URL, full link, or ID.
   */
  async getArtwork(input) {
    const illustId = extractIllustId(input);
    if (!illustId) {
      throw new Error(`Invalid Pixiv artwork ID or URL: "${input}"`);
    }
    const url = `${this.baseUrl}/ajax/illust/${illustId}`;
    const response = await this.fetchFn(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (response.status === 404) {
      throw new Error(`Artwork ${illustId} not found or has been deleted.`);
    }
    if (!response.ok) {
      throw new Error(`Pixiv API responded with status ${response.status}`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(json.message || `Failed to fetch artwork from Pixiv (ID: ${illustId})`);
    }
    const body = json.body;
    let pages = [];
    try {
      const pagesUrl = `${this.baseUrl}/ajax/illust/${illustId}/pages`;
      const pagesRes = await this.fetchFn(pagesUrl, {
        method: "GET",
        headers: this.getHeaders()
      });
      if (pagesRes.ok) {
        const pagesJson = await pagesRes.json();
        if (!pagesJson.error && Array.isArray(pagesJson.body) && pagesJson.body.length > 0) {
          pages = pagesJson.body;
        }
      }
    } catch (err) {
    }
    const desktopHasValidUrls = pages.length > 0 && pages[0]?.urls && (pages[0].urls.regular || pages[0].urls.original);
    if (!desktopHasValidUrls) {
      try {
        const touchUrl = `${this.baseUrl}/touch/ajax/illust/details?illust_id=${illustId}`;
        const touchRes = await this.fetchFn(touchUrl, {
          method: "GET",
          headers: this.getHeaders()
        });
        if (touchRes.ok) {
          const touchJson = await touchRes.json();
          const touchIllust = touchJson?.body?.illust_details;
          if (touchIllust) {
            const pageCount = parseInt(touchIllust.page_count, 10) || 1;
            const origUrl = touchIllust.url_big || touchIllust.url_original || touchIllust.url_s || touchIllust.url;
            if (origUrl) {
              pages = [];
              for (let i = 0; i < pageCount; i++) {
                const pageOrig = origUrl.replace(/_p\d+/, `_p${i}`);
                pages.push({
                  urls: {
                    thumb_mini: pageOrig,
                    small: pageOrig,
                    regular: pageOrig,
                    original: pageOrig
                  },
                  width: parseInt(touchIllust.width, 10) || 0,
                  height: parseInt(touchIllust.height, 10) || 0
                });
              }
            }
          }
        }
      } catch (touchErr) {
      }
    }
    if (pages.length === 0 && body.urls) {
      pages.push({
        urls: {
          thumb_mini: body.urls.mini,
          small: body.urls.small,
          regular: body.urls.regular,
          original: body.urls.original
        },
        width: body.width,
        height: body.height
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
      pages
    };
  }
  /**
   * Downloads an image from Pixiv CDN (i.pximg.net) with valid Referer headers.
   * Returns an ArrayBuffer and response metadata.
   */
  async fetchImage(imageUrl, signal) {
    if (!isPixivCdnUrl(imageUrl)) {
      throw new Error(`Untrusted Pixiv CDN image URL: "${imageUrl}"`);
    }
    const response = await this.fetchFn(imageUrl, {
      method: "GET",
      headers: this.getHeaders({
        Referer: this.referer
      }),
      signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image ${imageUrl}: HTTP ${response.status}`);
    }
    const data = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return { data, contentType };
  }
  /**
   * Concurrently downloads all pages of an artwork and packages them into a ZIP archive.
   */
  async downloadZip(artwork, options = {}) {
    if (!artwork.pages || artwork.pages.length === 0) {
      throw new Error("Artwork contains no downloadable pages");
    }
    const concurrency = Math.max(1, options.concurrency ?? 3);
    const { onProgress, signal } = options;
    const total = artwork.pages.length;
    let completedDownloads = 0;
    const report = (stage, current, t) => {
      if (onProgress) {
        const percentage = t > 0 ? Math.round(current / t * 100) : 0;
        onProgress({ stage, current, total: t, percentage });
      }
    };
    report("downloading", 0, total);
    const queue = [...artwork.pages.entries()];
    const downloadedPages = [];
    const worker = async () => {
      while (queue.length > 0) {
        if (signal?.aborted) {
          throw new Error("Download aborted by user");
        }
        const item = queue.shift();
        if (!item) break;
        const [index, page] = item;
        const pageUrl = page.urls.original || page.urls.regular;
        if (!pageUrl) {
          completedDownloads++;
          report("downloading", completedDownloads, total);
          continue;
        }
        const ext = pageUrl.split(".").pop()?.split("?")[0] || "jpg";
        const { data } = await this.fetchImage(pageUrl, signal);
        downloadedPages.push({ index, buffer: data, ext });
        completedDownloads++;
        report("downloading", completedDownloads, total);
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
    report("compressing", 0, 100);
    const zip = new JSZip();
    const safeTitle = sanitizeFilename(artwork.title);
    downloadedPages.sort((a, b) => a.index - b.index);
    for (const { index, buffer, ext } of downloadedPages) {
      const filename2 = `${artwork.id}_p${index}_${safeTitle}.${ext}`;
      zip.file(filename2, buffer);
    }
    const zipContent = await zip.generateAsync(
      {
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      },
      (metadata) => {
        report("compressing", Math.round(metadata.percent), 100);
      }
    );
    const filename = `${artwork.id}_${safeTitle}.zip`;
    return { data: zipContent, filename };
  }
};
export {
  PixivClient,
  extractIllustId,
  isPixivCdnUrl,
  sanitizeFilename
};
//# sourceMappingURL=index.mjs.map