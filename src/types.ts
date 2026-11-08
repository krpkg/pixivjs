export interface PixivPageUrls {
  thumb_mini: string;
  small: string;
  regular: string;
  original: string;
}

export interface PixivPage {
  urls: PixivPageUrls;
  width: number;
  height: number;
}

export interface PixivTag {
  tag: string;
  translation?: {
    en?: string;
    [key: string]: string | undefined;
  };
}

export interface UgoiraFrame {
  file: string;
  delay: number;
}

export interface UgoiraMeta {
  src: string;
  originalSrc: string;
  mime_type: string;
  frames: UgoiraFrame[];
}

export interface ArtworkData {
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

export interface ClientOptions {
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
  /**
   * Maximum retry attempts for transient network or rate-limiting errors. Defaults to 0.
   */
  retries?: number;
  /**
   * Delay in milliseconds between retries. Defaults to 1000.
   */
  retryDelay?: number;
}

export interface DownloadProgress {
  stage: 'downloading' | 'compressing';
  current: number;
  total: number;
  percentage: number;
}

export interface DownloadZipOptions {
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
