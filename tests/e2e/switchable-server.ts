import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

/** A static server for /color-critters/ whose root folder can be swapped to simulate a deploy. */
export class SwitchableServer {
  private server: Server | null = null;
  root = '';

  async start(root: string): Promise<string> {
    this.root = root;
    this.server = createServer((req, res) => {
      void (async () => {
        let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
        if (!path.startsWith('/color-critters/')) {
          res.writeHead(404).end();
          return;
        }
        path = path.slice('/color-critters/'.length) || 'index.html';
        const file = normalize(join(this.root, path));
        if (!file.startsWith(normalize(this.root))) {
          res.writeHead(403).end();
          return;
        }
        try {
          const body = await readFile(file);
          res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
          res.end(body);
        } catch {
          res.writeHead(404).end();
        }
      })();
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}/color-critters/`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
