# pixivjs

Lightweight, universal TypeScript client and SDK for fetching Pixiv artwork metadata and downloading artworks with ZIP archiving support.

Designed with zero platform-specific dependencies, fully compatible with Node.js, Bun, modern browsers, React Native, and Expo.

## Features

- Artwork ID Resolver: Supports raw numeric IDs, full desktop URLs, language-localized URLs (`/en/artworks/...`), query parameter URLs (`illust_id=...`), and mobile shared links.
- Resilient Fallback: Automatically cascades through Pixiv's desktop AJAX API, desktop page details, and mobile touch fallback (ensures R-18 and restricted works resolve properly).
- Domain & CDN Verification: Includes `isPixivCdnUrl()` to validate URLs from `i.pximg.net` and `pixiv.net`.
- In-Memory ZIP Packaging: Concurrent image downloading with configurable concurrency and real-time progress callbacks using JSZip.
- Customizable Network Layer: Accepts custom `fetch` implementations, user agents, cookies (such as `PHPSESSID`), and referer headers.

## Installation

Using krpkg CLI:

```bash
krpkg install pixivjs
```

Using Bun:

```bash
bun add github:krpkg/pixivjs
```

Using npm:

```bash
npm install github:krpkg/pixivjs
```

## Quick Start

```typescript
import { PixivClient } from 'pixivjs';

const client = new PixivClient({
  // Optional custom cookie for R-18 / member-only access
  // cookie: 'PHPSESSID=...',
});

// 1. Fetch Artwork Details
const artwork = await client.getArtwork('https://www.pixiv.net/en/artworks/12345678');
console.log('Title:', artwork.title);
console.log('Artist:', artwork.userName);
console.log('Pages:', artwork.pages.length);

// 2. Download all pages into a ZIP file
const { data, filename } = await client.downloadZip(artwork, {
  concurrency: 3,
  onProgress: (p) => {
    console.log(`[${p.stage}] ${p.current}/${p.total} (${p.percentage}%)`);
  },
});

console.log(`Downloaded ${filename} (${data.byteLength} bytes)`);
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
}
```

### Download Options

```typescript
interface DownloadOptions {
  concurrency?: number; // Concurrent downloads (default: 3)
  signal?: AbortSignal; // AbortSignal for cancellation
  onProgress?: (progress: DownloadProgress) => void;
}
```

## License

Apache-2.0
