import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import * as music from 'music-metadata';
import * as path from 'path';

export interface ScanResult {
  path: string;
  size: number;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverPath?: string;
  lyrics?: string;
  mtime: Date;
  [key: string]: any;
}

export class LocalMusicScanner {
  constructor(private cacheDir: string) {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  async scanMusic(dir: string, onFile?: (result: ScanResult) => Promise<void>): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    if (!fs.existsSync(dir)) return results;

    await this.traverse(dir, async (filePath) => {
      const metadata = await this.parseFile(filePath);
      if (metadata) {
        if (onFile) {
          await onFile(metadata);
        }
        results.push(metadata);
      }
    });
    return results;
  }

  async scanAudiobook(dir: string, onFile?: (result: ScanResult) => Promise<void>): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    if (!fs.existsSync(dir)) return results;

    await this.traverse(dir, async (filePath) => {
      const metadata = await this.parseFile(filePath);
      if (metadata) {
        // Override album with parent folder name
        const parentDir = path.dirname(filePath);
        const folderName = path.basename(parentDir);
        metadata.album = folderName;
        if (!metadata.artist) {
          metadata.artist = folderName;
        }

        // If no cover, look for first image in directory
        if (!metadata.coverPath) {
          const coverPath = await this.findCoverInDirectory(parentDir);
          if (coverPath) {
            metadata.coverPath = coverPath;
          }
        }

        if (onFile) {
          await onFile(metadata);
        }
        results.push(metadata);
      }
    });
    return results;
  }

  async countFiles(dir: string): Promise<number> {
    let count = 0;
    if (!fs.existsSync(dir)) return 0;

    const traverseCount = (currentDir: string) => {
      try {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
          const fullPath = path.join(currentDir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              traverseCount(fullPath);
            } else if (/\.(mp3|flac|ogg|wav|m4a)$/i.test(file)) {
              count++;
            }
          } catch (e) {
            console.warn(`Skipping file ${fullPath}: ${e}`);
          }
        }
      } catch (e) {
        console.warn(`Failed to read dir ${currentDir}: ${e}`);
      }
    };

    traverseCount(dir);
    return count;
  }

  private async traverse(dir: string, callback: (path: string) => Promise<void>) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            await this.traverse(fullPath, callback);
          } else if (/\.(mp3|flac|ogg|wav|m4a)$/i.test(file)) {
            await callback(fullPath);
          }
        } catch (e) {
          console.warn(`Skipping file ${fullPath}: ${e}`);
        }
      }
    } catch (e) {
      console.warn(`Failed to read dir ${dir}: ${e}`);
    }
  }

  public async parseFile(filePath: string): Promise<ScanResult | null> {
    try {
      const metadata = await music.parseFile(filePath);
      const common = metadata.common;

      let coverPath = null;
      if (common.picture && common.picture.length > 0) {
        const picture = common.picture[0];
        const ext = picture.format.split('/')[1] || 'jpg';
        const fileName = path.basename(filePath);
        // Cover name consistent with file name
        const coverName = `${fileName}.${ext}`;
        const savePath = path.join(this.cacheDir, coverName);

        fs.writeFileSync(savePath, picture.data);
        coverPath = savePath;
      }

      // Extract lyrics from metadata or file
      let lyrics = null;
      if (common.lyrics && common.lyrics.length > 0) {
        // lyrics can be string[] or string
        lyrics = Array.isArray(common.lyrics) ? common.lyrics.join('\n') : common.lyrics;
      } else {
        // Try to find lyrics in native tags (e.g., USLT in ID3v2)
        if (metadata.native && metadata.native['ID3v2.3']) {
          const uslt = metadata.native['ID3v2.3'].find((tag: any) => tag.id === 'USLT');
          if (uslt && uslt.value && uslt.value.text) {
            lyrics = uslt.value.text;
          }
        }

        // Also check ID3v2.4 just in case
        if (!lyrics && metadata.native && metadata.native['ID3v2.4']) {
          const uslt = metadata.native['ID3v2.4'].find((tag: any) => tag.id === 'USLT');
          if (uslt && uslt.value && uslt.value.text) {
            lyrics = uslt.value.text;
          }
        }

        // If still no lyrics, look for lyrics file in the same directory
        if (!lyrics) {
          lyrics = await this.findLyricsFile(filePath);
        }
      }

      // Sanitize lyrics (remove null bytes)
      if (lyrics) {
        lyrics = lyrics.replace(/\u0000/g, '');
      }

      let title = common.title;
      let artist = common.artist || common.album;
      let album = common.album;

      // Fix encoding if garbled
      title = this.fixEncoding(title || '');
      artist = this.fixEncoding(artist || '');
      album = this.fixEncoding(album || '');

      // Fallback to filename if title is missing or still garbled
      if (!title || this.isGarbled(title)) {
        title = path.basename(filePath, path.extname(filePath));
      }

      return {
        path: filePath,
        size: fs.statSync(filePath).size,
        mtime: fs.statSync(filePath).mtime,
        ...common,
        title,
        artist: artist || '未知',
        album: album || '未知',
        duration: metadata.format.duration,
        coverPath: coverPath || undefined,
        lyrics: lyrics || undefined,
      };
    } catch (e) {
      console.error(`Failed to parse ${filePath}`, e);
      return null;
    }
  }

  private async findLyricsFile(audioFilePath: string): Promise<string | null> {
    const dir = path.dirname(audioFilePath);
    const baseName = path.basename(audioFilePath, path.extname(audioFilePath));

    // Try .lrc first, then .txt
    const lrcPath = path.join(dir, `${baseName}.lrc`);
    const txtPath = path.join(dir, `${baseName}.txt`);

    if (fs.existsSync(lrcPath)) {
      return fs.readFileSync(lrcPath, 'utf-8');
    }

    if (fs.existsSync(txtPath)) {
      return fs.readFileSync(txtPath, 'utf-8');
    }

    return null;
  }

  private async findCoverInDirectory(dir: string): Promise<string | null> {
    try {
      const files = fs.readdirSync(dir);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext)) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isFile()) {
            // Copy to cache directory
            const cacheName = `${path.basename(dir)}_cover${ext}`;
            const cachePath = path.join(this.cacheDir, cacheName);
            fs.copyFileSync(fullPath, cachePath);
            return cachePath;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to find cover in ${dir}:`, e);
    }

    return null;
  }

  private isGarbled(str: string): boolean {
    if (!str) return false;
    // Check for control characters (except tab, newline, carriage return)
    const controlChars = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/;
    if (controlChars.test(str)) return true;

    // Check for "REPLACEMENT CHARACTER" (U+FFFD)
    if (str.includes('\uFFFD')) return true;

    return false;
  }

  private fixEncoding(str: string): string {
    if (!str) return str;
    if (!this.isGarbled(str)) return str;

    try {
      // Try to convert back to buffer using ISO-8859-1 (raw bytes)
      // and then decode as GBK
      const buf = iconv.encode(str, 'latin1');
      const decoded = iconv.decode(buf, 'gbk');

      // If the decoded string doesn't look garbled, use it
      if (decoded && !this.isGarbled(decoded)) {
        return decoded;
      }
    } catch (e) {
      // Ignore
    }
    return str;
  }
}

export default LocalMusicScanner;