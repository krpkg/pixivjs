import { describe, it, expect } from 'vitest';
import { extractIllustId, isPixivCdnUrl, sanitizeFilename } from './utils';

describe('extractIllustId', () => {
  it('extracts direct numeric IDs', () => {
    expect(extractIllustId('151772434')).toBe('151772434');
    expect(extractIllustId(151772434)).toBe('151772434');
  });

  it('extracts from artwork URLs (desktop and localized)', () => {
    expect(extractIllustId('https://www.pixiv.net/artworks/151772434')).toBe('151772434');
    expect(extractIllustId('https://www.pixiv.net/en/artworks/151772434')).toBe('151772434');
    expect(extractIllustId('https://www.pixiv.net/ja/artworks/151772434')).toBe('151772434');
  });

  it('extracts from legacy query parameters', () => {
    expect(
      extractIllustId('https://www.pixiv.net/member_illust.php?mode=medium&illust_id=151772434')
    ).toBe('151772434');
  });

  it('extracts from social share text containing URL', () => {
    const text = 'Artwork Title #pixiv https://www.pixiv.net/en/artworks/151772434';
    expect(extractIllustId(text)).toBe('151772434');
  });

  it('extracts from pixiv.me short links', () => {
    expect(extractIllustId('https://pixiv.me/art/151772434')).toBe('151772434');
  });

  it('returns null for invalid or third-party URL inputs with digits', () => {
    expect(extractIllustId('')).toBeNull();
    expect(extractIllustId('not-a-pixiv-id')).toBeNull();
    expect(extractIllustId('https://example.com/post/12345678')).toBeNull();
  });
});

describe('isPixivCdnUrl', () => {
  it('identifies valid pixiv CDN and domain URLs', () => {
    expect(isPixivCdnUrl('https://i.pximg.net/img-original/img/2024/01/01/00/00/00/12345_p0.jpg')).toBe(true);
    expect(isPixivCdnUrl('https://www.pixiv.net/ajax/illust/12345')).toBe(true);
  });

  it('rejects untrusted domains', () => {
    expect(isPixivCdnUrl('https://malicious.site.com/image.jpg')).toBe(false);
    expect(isPixivCdnUrl('http://insecure.pximg.net')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('replaces reserved file characters with underscore', () => {
    expect(sanitizeFilename('Cool:Art*Work?')).toBe('Cool_Art_Work_');
  });
});
