import http from 'http';
import url from 'url';

import Store, { isENR } from '#app/store';

interface QueryParams {
  count?: number;
}

const isValidCount = (count?: number | number[]): count is number => {
  if (count === undefined) return true;
  if (typeof count !== 'string') return false;
  const parsed = Number.parseInt(count);
  if (Number.isNaN(parsed)) return false;
  return parsed > 0 && parsed <= 1000;
};

const isValidParams = (params: unknown): params is QueryParams => {
  if (typeof params !== 'object' || params === null) return false;
  const { count } = params as QueryParams;
  if (!isValidCount(count)) return false;
  return true;
};

function parsePayload(payload: string): string[] {
  try {
    const enrs = JSON.parse(payload) as unknown[];
    if (!Array.isArray(enrs)) return [];
    return enrs.filter((enr: unknown) => isENR(enr));
  } catch (error) {
    return [];
  }
}

export default async (req: http.IncomingMessage, res: http.ServerResponse) => {
  if (req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const buffers: Buffer[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    Store.addENRs(parsePayload(Buffer.concat(buffers).toString()));
    res.writeHead(200).end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.method === 'GET' && typeof req.url === 'string') {
    try {
      const query = (Object(url.parse(req.url, true).query) ?? {}) as unknown;
      if (isValidParams(query)) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(await Store.getENRs(query.count)));
        return;
      }
    } catch (err) {
      res.writeHead(400).end();
      return;
    }
    // malformed request
    res.writeHead(400).end();
    return;
  }
  res.writeHead(404).end();
};
