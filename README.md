# pixivjs

A lightweight, universal TypeScript client & SDK for fetching Pixiv artwork metadata and downloading artworks with ZIP archiving support.

Designed to mirror the architecture of `nhentaijs` with zero platform dependencies, fully compatible with Node.js, Bun, browsers, React Native, and Expo.

## Features

- **Artwork ID Resolver**: Supports raw numeric IDs, full desktop URLs, language-localized URLs (`/en/artworks/...`), query param URLs (`illust_id=...`), and mobile shared links.
- **Resilient Fallback**: Automatically cascades through Pixiv's desktop AJAX API, desktop page details, and mobile touch fallback (ensures R-18 and restricted works resolve properly).
- **Domain & CDN Verification**: Includes `isPixivCdnUrl()` to validate URLs from `i.pximg.net` and `pixiv.net`.
- **In-Memory ZIP Packaging**: Concurrent image downloading with configurable concurrency and real-time progress callbacks using JSZip.
- **Customizable Network Layer**: Accepts custom `fetch` implementations, user agents, cookies (e.g. `PHPSESSID`), and referer headers.

## Installation

Within the monorepo:
```bash
bun add pixivjs --workspace
```

## Quick Example

```typescript
import { PixivClient } from 'pixivjs';

const client = new PixivClient({
  // Optional custom cookie or options
  // cookie: 'PHPSESSID=...',
});

// 1. Fetch Artwork Details
const artwork = await client.getArtwork('https://www.pixiv.net/en/artworks/12345678');
console.log(artwork.title, artwork.userName, artwork.pages.length);

// 2. Download all pages into a ZIP file
const { data, filename } = await client.downloadZip(artwork, {
  concurrency: 3,
  onProgress: (p) => {
    console.log(`[${p.stage}] ${p.current}/${p.total} (${p.percentage}%)`);
  },
});
```
