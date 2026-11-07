interface PixivPageUrls {
    thumb_mini: string;
    small: string;
    regular: string;
    original: string;
}
interface PixivPage {
    urls: PixivPageUrls;
    width: number;
    height: number;
}
interface PixivTag {
    tag: string;
    translation?: {
        en?: string;
        [key: string]: string | undefined;
    };
}
interface ArtworkData {
    id: string;
    title: string;
    description: string;
    illustType: number;
    createDate: string;
    uploadDate: string;
    pageCount: number;
    width: number;
    height: number;
    userName: string;
    userId: string;
    userAccount: string;
    tags: PixivTag[];
    likeCount: number;
    bookmarkCount: number;
    viewCount: number;
    urls: {
        mini?: string;
        thumb?: string;
        small?: string;
        regular?: string;
        original?: string;
        [key: string]: string | undefined;
    };
    pages: PixivPage[];
}
interface ClientOptions {
    /**
     * Base URL for Pixiv web requests. Defaults to "https://www.pixiv.net"
     */
    baseUrl?: string;
    /**
     * Custom fetch implementation (e.g. proxy fetch, undici, or global fetch)
     */
    fetch?: typeof fetch;
    /**
     * Optional custom User-Agent
     */
    userAgent?: string;
    /**
     * Optional custom session cookie (e.g. PHPSESSID for logged-in / R-18 access)
     */
    cookie?: string;
    /**
     * Custom referer. Defaults to "https://www.pixiv.net/"
     */
    referer?: string;
}
interface DownloadProgress {
    stage: 'downloading' | 'compressing';
    current: number;
    total: number;
    percentage: number;
}
interface DownloadZipOptions {
    /**
     * Number of simultaneous image downloads. Defaults to 3.
     */
    concurrency?: number;
    /**
     * Callback invoked as download and ZIP compression progress updates.
     */
    onProgress?: (progress: DownloadProgress) => void;
    /**
     * AbortSignal to cancel download process.
     */
    signal?: AbortSignal;
}

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
declare function extractIllustId(input: string | number): string | null;
/**
 * Validates whether a given URL is a trusted Pixiv domain or CDN.
 */
declare function isPixivCdnUrl(urlStr: string): boolean;
/**
 * Sanitizes titles for safe file system names across platforms.
 */
declare function sanitizeFilename(name: string): string;

declare class PixivClient {
    private baseUrl;
    private fetchFn;
    private userAgent;
    private cookie?;
    private referer;
    constructor(options?: ClientOptions);
    /**
     * Internal header builder with Pixiv Referer & User-Agent
     */
    private getHeaders;
    /**
     * Fetches metadata for an artwork by URL, full link, or ID.
     */
    getArtwork(input: string | number): Promise<ArtworkData>;
    /**
     * Downloads an image from Pixiv CDN (i.pximg.net) with valid Referer headers.
     * Returns an ArrayBuffer and response metadata.
     */
    fetchImage(imageUrl: string, signal?: AbortSignal): Promise<{
        data: ArrayBuffer;
        contentType: string;
    }>;
    /**
     * Concurrently downloads all pages of an artwork and packages them into a ZIP archive.
     */
    downloadZip(artwork: ArtworkData, options?: DownloadZipOptions): Promise<{
        data: Uint8Array;
        filename: string;
    }>;
}

export { type ArtworkData, type ClientOptions, type DownloadProgress, type DownloadZipOptions, PixivClient, type PixivPage, type PixivPageUrls, type PixivTag, extractIllustId, isPixivCdnUrl, sanitizeFilename };
