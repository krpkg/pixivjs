# @krpkg/pixivjs

Lightweight, universal TypeScript client and SDK for fetching Pixiv artwork metadata and downloading artworks with ZIP archiving support.

Designed with zero platform-specific dependencies, fully compatible with Node.js, Bun, modern browsers, React Native, and Expo.

## Features

- **Artwork ID Resolver**: Supports raw numeric IDs, full desktop URLs, language-localized URLs (`/en/artworks/...`), query parameter URLs (`illust_id=...`), and mobile shared links.
- **Resilient Fallback & Retries**: Automatically cascades through Pixiv's desktop AJAX API, desktop page details, and mobile touch fallback (ensuring R-18 and restricted works resolve properly). Configurable auto-retry with exponential delay for 429 and transient 5xx errors.
- **Ugoira Support**: Extract animation frame lists and delay metadata via `client.getUgoiraMeta()`.
- **Domain & CDN Verification**: Includes `isPixivCdnUrl()` to validate URLs from `i.pximg.net` and `pixiv.net`.
- **Typed Error Hierarchy**: Handle specific errors like `PixivNotFoundError`, `PixivRateLimitError`, and `PixivAuthError`.
- **In-Memory ZIP Packaging**: Concurrent image downloading with configurable concurrency and real-time progress callbacks using dynamic JSZip loading.
- **Customizable Network Layer**: Accepts custom `fetch` implementations, user agents, cookies (such as `PHPSESSID`), and referer headers.

## Installation

Using npm:

```bash
npm install @krpkg/pixivjs
```

Using Bun:

```bash
bun add @krpkg/pixivjs
```

Using pnpm:

```bash
pnpm add @krpkg/pixivjs
```

## Quick Start

```typescript
import { PixivClient, PixivNotFoundError, PixivRateLimitError } from '@krpkg/pixivjs';

const client = new PixivClient({
  // Optional custom cookie for R-18 / member-only access
  // cookie: 'PHPSESSID=...',
  // Optional retry attempts on rate limit or transient network failure
  retries: 2,
  retryDelay: 1000,
});

try {
  // 1. Fetch Artwork Details
  const artwork = await client.getArtwork('https://www.pixiv.net/en/artworks/12345678');
  console.log('Title:', artwork.title);
  console.log('Artist:', artwork.userName);
  console.log('Pages:', artwork.pages.length);

  // 2. Fetch Ugoira metadata (if illustType === 2)
  if (artwork.illustType === 2) {
    const ugoira = await client.getUgoiraMeta(artwork.id);
    console.log(`Ugoira frames: ${ugoira.frames.length}`);
  }

  // 3. Download all pages into a ZIP file
  const { data, filename } = await client.downloadZip(artwork, {
    concurrency: 3,
    onProgress: (p) => {
      console.log(`[${p.stage}] ${p.current}/${p.total} (${p.percentage}%)`);
    },
  });

  console.log(`Downloaded ${filename} (${data.byteLength} bytes)`);
} catch (err) {
  if (err instanceof PixivNotFoundError) {
    console.error('Artwork does not exist or was deleted.');
  } else if (err instanceof PixivRateLimitError) {
    console.error('Hit Pixiv rate limit.');
  } else {
    throw err;
  }
}
```

## Modular Imports

You can import utilities and error classes independently:

```typescript
import { extractIllustId, isPixivCdnUrl, sanitizeFilename } from '@krpkg/pixivjs/utils';
import { PixivError, PixivNotFoundError } from '@krpkg/pixivjs/errors';
```

## Configuration

### Client Options

```typescript
interface ClientOptions {
  baseUrl?: string;    // Default: "https://www.pixiv.net"
  cookie?: string;     // Session cookie (e.g. PHPSESSID)
  userAgent?: string;  // Custom User-Agent
  referer?: string;    // Custom Referer header (default: "https://www.pixiv.net/")
  fetch?: typeof fetch;// Custom fetch implementation
  retries?: number;    // Number of retry attempts on 429/5xx (default: 0)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
}
```

### Download Options

```typescript
interface DownloadZipOptions {
  concurrency?: number; // Concurrent downloads (default: 3)
  signal?: AbortSignal; // AbortSignal for cancellation
  onProgress?: (progress: DownloadProgress) => void;
}
```

## License

Apache-2.0
