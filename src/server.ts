import http from 'http';

import { PORT, SHARED_SECRET } from '#app/constants';
import handleENodes from '#handlers/enodes';
import handleENRs from '#handlers/enrs';
import handleETHStatuses from '#handlers/eth-statuses';
import handlePhase0Statuses from '#handlers/phase0-statuses';

export default class Server {
  static server: http.Server | undefined;

  static init() {
    if (Server.server) return;
    Server.server = http.createServer(async (req, res) => {
      if (SHARED_SECRET && req.headers.authorization !== `Basic ${SHARED_SECRET}`) {
        res.writeHead(401);
        res.end();
        return;
      }
      if (req.url === '/eth_statuses') {
        handleETHStatuses(req, res);
        return;
      }
      if (req.url === '/enodes' || req.url?.startsWith('/enodes?')) {
        handleENodes(req, res);
        return;
      }
      if (req.url === '/phase0_statuses') {
        handlePhase0Statuses(req, res);
        return;
      }
      if (req.url === '/enrs' || req.url?.startsWith('/enrs?')) {
        handleENRs(req, res);
        return;
      }

      res.writeHead(502).end();
    });
    Server.server.listen(PORT);
  }

  static async shutdown() {
    await Server.server?.close();
  }
}
