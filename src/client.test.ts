import { describe, it, expect, vi } from 'vitest';
import { PixivClient } from './client';
import {
  PixivValidationError,
  PixivNotFoundError,
  PixivRateLimitError,
  PixivAuthError,
  PixivDownloadError,
} from './errors';
import type { ArtworkData } from './types';

describe('PixivClient', () => {
  it('throws PixivValidationError for invalid artwork input', async () => {
    const client = new PixivClient();
    await expect(client.getArtwork('invalid-link')).rejects.toThrow(PixivValidationError);
  });

  it('fetches artwork successfully with desktop pages', async () => {
    const mockArtworkResponse = {
      error: false,
      body: {
        id: '12345678',
        title: 'Sample Artwork',
        description: 'Sample description',
        illustType: 0,
        createDate: '2024-01-01',
        uploadDate: '2024-01-01',
        pageCount: 2,
        width: 1000,
        height: 1000,
        userName: 'Artist',
        userId: '999',
        userAccount: 'artist999',
        tags: { tags: [{ tag: 'test' }] },
        likeCount: 10,
        bookmarkCount: 20,
        viewCount: 30,
        urls: {},
      },
    };

    const mockPagesResponse = {
      error: false,
      body: [
        {
          urls: {
            thumb_mini: 'https://i.pximg.net/p0_mini.jpg',
            small: 'https://i.pximg.net/p0_small.jpg',
            regular: 'https://i.pximg.net/p0_regular.jpg',
            original: 'https://i.pximg.net/p0_orig.jpg',
          },
          width: 1000,
          height: 1000,
        },
        {
          urls: {
            thumb_mini: 'https://i.pximg.net/p1_mini.jpg',
            small: 'https://i.pximg.net/p1_small.jpg',
            regular: 'https://i.pximg.net/p1_regular.jpg',
            original: 'https://i.pximg.net/p1_orig.jpg',
          },
          width: 1000,
          height: 1000,
        },
      ],
    };

    const mockFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/ajax/illust/12345678')) {
        return new Response(JSON.stringify(mockArtworkResponse), { status: 200 });
      }
      if (url.endsWith('/ajax/illust/12345678/pages')) {
        return new Response(JSON.stringify(mockPagesResponse), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    });

    const client = new PixivClient({ fetch: mockFetch as any });
    const artwork = await client.getArtwork('12345678');

    expect(artwork.id).toBe('12345678');
    expect(artwork.title).toBe('Sample Artwork');
    expect(artwork.pages.length).toBe(2);
    expect(artwork.pages[0].urls.original).toBe('https://i.pximg.net/p0_orig.jpg');
  });

  it('handles 404 not found error with PixivNotFoundError', async () => {
    const mockFetch = vi.fn(async () => new Response('Not found', { status: 404 }));
    const client = new PixivClient({ fetch: mockFetch as any });

    await expect(client.getArtwork('12345678')).rejects.toThrow(PixivNotFoundError);
  });

  it('handles 429 rate limit error with PixivRateLimitError', async () => {
    const mockFetch = vi.fn(async () => new Response('Too Many Requests', { status: 429 }));
    const client = new PixivClient({ fetch: mockFetch as any });

    await expect(client.getArtwork('12345678')).rejects.toThrow(PixivRateLimitError);
  });

  it('handles 403 forbidden error with PixivAuthError', async () => {
    const mockFetch = vi.fn(async () => new Response('Forbidden', { status: 403 }));
    const client = new PixivClient({ fetch: mockFetch as any });

    await expect(client.getArtwork('12345678')).rejects.toThrow(PixivAuthError);
  });

  it('fetches ugoira metadata correctly', async () => {
    const mockUgoiraResponse = {
      error: false,
      body: {
        src: 'https://i.pximg.net/ugoira600x600.zip',
        originalSrc: 'https://i.pximg.net/ugoira1920x1080.zip',
        mime_type: 'image/vnd.pixiv.ugoku-illust',
        frames: [
          { file: '000000.jpg', delay: 100 },
          { file: '000001.jpg', delay: 120 },
        ],
      },
    };

    const mockFetch = vi.fn(async () => new Response(JSON.stringify(mockUgoiraResponse), { status: 200 }));
    const client = new PixivClient({ fetch: mockFetch as any });

    const ugoira = await client.getUgoiraMeta('12345678');
    expect(ugoira.frames.length).toBe(2);
    expect(ugoira.frames[0].file).toBe('000000.jpg');
    expect(ugoira.mime_type).toBe('image/vnd.pixiv.ugoku-illust');
  });

  it('rejects untrusted image URL in fetchImage', async () => {
    const client = new PixivClient();
    await expect(client.fetchImage('https://evil-domain.com/image.jpg')).rejects.toThrow(
      PixivValidationError
    );
  });

  it('downloads and packages ZIP archive correctly', async () => {
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // mock JPEG header
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('pximg.net')) {
        return new Response(sampleBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const client = new PixivClient({ fetch: mockFetch as any });
    const artwork: ArtworkData = {
      id: '12345678',
      title: 'Cool Artwork',
      description: 'desc',
      illustType: 0,
      createDate: '',
      uploadDate: '',
      pageCount: 1,
      width: 100,
      height: 100,
      userName: 'artist',
      userId: '1',
      userAccount: 'artist',
      tags: [],
      likeCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
      urls: {},
      pages: [
        {
          urls: {
            thumb_mini: '',
            small: '',
            regular: 'https://i.pximg.net/sample_p0.jpg',
            original: 'https://i.pximg.net/sample_p0.jpg',
          },
          width: 100,
          height: 100,
        },
      ],
    };

    const progressLogs: string[] = [];
    const result = await client.downloadZip(artwork, {
      onProgress: (p) => progressLogs.push(`${p.stage}:${p.percentage}`),
    });

    expect(result.filename).toBe('12345678_Cool Artwork.zip');
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBeGreaterThan(0);
    expect(progressLogs.length).toBeGreaterThan(0);
  });

  it('aborts download when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort();

    const client = new PixivClient();
    const artwork: ArtworkData = {
      id: '12345678',
      title: 'Test',
      description: '',
      illustType: 0,
      createDate: '',
      uploadDate: '',
      pageCount: 1,
      width: 100,
      height: 100,
      userName: '',
      userId: '',
      userAccount: '',
      tags: [],
      likeCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
      urls: {},
      pages: [
        {
          urls: {
            thumb_mini: '',
            small: '',
            regular: '',
            original: 'https://i.pximg.net/sample_p0.jpg',
          },
          width: 100,
          height: 100,
        },
      ],
    };

    await expect(
      client.downloadZip(artwork, { signal: controller.signal })
    ).rejects.toThrow(PixivDownloadError);
  });
});
