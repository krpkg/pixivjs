/**
 * Robust parser for Pixiv artwork IDs.
 * Handles:
 * - Pure IDs: "151772434"
 * - Direct URLs: "https://www.pixiv.net/artworks/151772434"
 * - Localized URLs: "https://www.pixiv.net/en/artworks/151772434"
 * - Query params: "https://www.pixiv.net/member_illust.php?mode=medium&illust_id=151772434"
 * - Pixiv app shared text: "おめかし🐰うさギンガムチェック | 鯱ノ丸 #pixiv https://www.pixiv.net/en/artworks/151772434"
 * - Mobile short links: "pixiv.me/..." or "i.pximg.net/..."
 */
export function extractIllustId(input: string | number): string | null {
  if (typeof input === 'number') {
    return Number.isSafeInteger(input) && input > 0 ? String(input) : null;
  }
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Pure numeric ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Contains /artworks/<id> (handles /artworks/123, /en/artworks/123, /zh/artworks/123, etc.)
  const artworksMatch = trimmed.match(/artworks\/(\d+)/i);
  if (artworksMatch) {
    return artworksMatch[1];
  }

  // 3. Contains illust_id=<id>
  const illustMatch = trimmed.match(/illust_id=(\d+)/i);
  if (illustMatch) {
    return illustMatch[1];
  }

  // 4. Fallback digits inside verified pixiv/pximg domains
  const pixivDomainFallback = trimmed.match(
    /https?:\/\/(?:[a-zA-Z0-9_-]+\.)?(?:pixiv\.(?:net|me)|pximg\.net)\/[^\s]*?(\d{7,10})/i
  );
  if (pixivDomainFallback) {
    return pixivDomainFallback[1];
  }

  return null;
}

/**
 * Validates whether a given URL is a trusted Pixiv domain or CDN.
 */
export function isPixivCdnUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'i.pximg.net' ||
        parsed.hostname.endsWith('.pximg.net') ||
        parsed.hostname === 'pixiv.net' ||
        parsed.hostname.endsWith('.pixiv.net'))
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes titles for safe file system names across platforms.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'pixiv_artwork';
}

/**
 * Async sleep utility for retry intervals.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
