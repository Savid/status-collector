import http from 'http';

import Store, { ETHStatus, isETHStatus } from '#app/store';

function parsePayload(payload: string): ETHStatus[] {
  try {
    const statuses = JSON.parse(payload) as unknown[];
    if (!Array.isArray(statuses)) return [];
    return statuses.filter((status: unknown) => isETHStatus(status));
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
    Store.addETHStatuses(
      parsePayload(Buffer.concat(buffers).toString()),
      Array.isArray(req.headers['cf-connecting-ip'])
        ? req.headers['cf-connecting-ip'][0]
        : req.headers['cf-connecting-ip'],
    );
    res.writeHead(200).end();
    return;
  }
  res.writeHead(404).end();
};
