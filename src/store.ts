import Libp2pPest, { PeerError as Libp2pPeerError } from '@savid/libp2p-pest';
import logger from '@savid/logger';
import RLPxPest, { PeerError as RLPxPeerError } from '@savid/rlpx-pest';
import sqlite3 from 'sqlite3';

import { DB_PATH, NETWORK_ID } from '#app/constants';

export interface ETHStatus {
  enode: string;
  error?: {
    message: string;
    code?: RLPxPeerError['code'];
  };
  date: string;
  data?: Omit<Awaited<ReturnType<typeof RLPxPest>>, 'networkId' | 'td'> & {
    networkId: string;
    td: string;
  };
}

export interface Phase0Status {
  enr: string;
  error?: {
    message: string;
    code?: Libp2pPeerError['code'];
  };
  date: string;
  data?: Awaited<ReturnType<typeof Libp2pPest>>;
}

export function isENode(enode: unknown): enode is string {
  if (typeof enode !== 'string') return false;
  return enode.startsWith('enode://');
}

export function isENR(enr: unknown): enr is string {
  if (typeof enr !== 'string') return false;
  return enr.startsWith('enr:');
}

export function isETHStatus(status: unknown): status is ETHStatus {
  if (typeof status !== 'object' || status === null) return false;
  const { enode, error, data, date } = status as Record<string, unknown>;
  if (typeof enode !== 'string') return false;
  if (date && typeof date !== 'string') return false;
  if (error === undefined && data === undefined) return false;
  if (error !== undefined) {
    if (typeof error !== 'object' || error === null) return false;
    const { message, code } = error as Record<string, unknown>;
    if (typeof message !== 'string') return false;
    if (code !== undefined && typeof code !== 'string') return false;
  }
  if (data !== undefined) {
    if (typeof data !== 'object' || data === null) return false;
    const { networkId, td } = data as Record<string, unknown>;
    if (typeof networkId !== 'string') return false;
    if (typeof td !== 'string') return false;
  }
  return true;
}

export function isPhase0Status(status: unknown): status is Phase0Status {
  if (typeof status !== 'object' || status === null) return false;
  const { enr, error, data, date } = status as Record<string, unknown>;
  if (typeof enr !== 'string') return false;
  if (date && typeof date !== 'string') return false;
  if (error === undefined && data === undefined) return false;
  if (error !== undefined) {
    if (typeof error !== 'object' || error === null) return false;
    const { message, code } = error as Record<string, unknown>;
    if (typeof message !== 'string') return false;
    if (code !== undefined && typeof code !== 'string') return false;
  }
  if (data !== undefined) {
    if (typeof data !== 'object' || data === null) return false;
    const { forkDigest, finalizedRoot, finalizedEpoch, headRoot, headSlot } = data as Record<
      string,
      unknown
    >;
    if (typeof forkDigest !== 'string') return false;
    if (typeof finalizedRoot !== 'string') return false;
    if (typeof finalizedEpoch !== 'number') return false;
    if (typeof headRoot !== 'string') return false;
    if (typeof headSlot !== 'number') return false;
  }
  return true;
}

export default class Store {
  static db: sqlite3.Database | undefined;

  static enodes: Map<string, ETHStatus[]> = new Map();

  static enrs: Map<string, Phase0Status[]> = new Map();

  static async init() {
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH ?? ':memory:', (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.db?.run(
        `
        CREATE TABLE IF NOT EXISTS enodes (
          enode TEXT PRIMARY KEY,
          added_date TEXT NOT NULL,
          last_seen_date TEXT NOT NULL,
          last_attempt_date TEXT NOT NULL,
          last_status_date TEXT,
          consecutive_failures INTEGER NOT NULL,
          disabled_until_date TEXT,
          network_id TEXT
        );
        `,
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.db?.run(
        `
        CREATE TABLE IF NOT EXISTS eth_statuses (
          enode TEXT NOT NULL,
          added_date TEXT NOT NULL,
          error_message TEXT,
          error_code TEXT,
          network_id TEXT,
          td TEXT,
          best_hash TEXT,
          genesis_hash TEXT,
          fork_hash TEXT,
          fork_next TEXT,
          client TEXT,
          source_ip TEXT,
          FOREIGN KEY (enode) 
            REFERENCES enodes (enodes) 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
        );
        `,
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.db?.run(
        `
        CREATE TABLE IF NOT EXISTS enrs (
          enr TEXT PRIMARY KEY,
          added_date TEXT NOT NULL,
          last_seen_date TEXT NOT NULL,
          last_attempt_date TEXT NOT NULL,
          last_status_date TEXT,
          consecutive_failures INTEGER NOT NULL,
          disabled_until_date TEXT
        );
        `,
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.db?.run(
        `
        CREATE TABLE IF NOT EXISTS phase0_statuses (
          enr TEXT NOT NULL,
          added_date TEXT NOT NULL,
          error_message TEXT,
          error_code TEXT,
          fork_digest TEXT,
          finalized_root TEXT,
          finalized_epoch TEXT,
          head_root TEXT,
          head_slot TEXT,
          source_ip TEXT,
          FOREIGN KEY (enr) 
            REFERENCES enrs (enrs) 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
        );
        `,
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  static async getENodes(count = 100): Promise<string[]> {
    const enodes = await new Promise<string[]>((resolve, reject) => {
      this.db?.all(
        `
        SELECT enode
        FROM enodes
        WHERE (network_id IS NULL OR network_id = ?) AND (disabled_until_date IS NULL OR disabled_until_date < date(?))
        ORDER BY last_attempt_date DESC
        LIMIT ?;
        `,
        [NETWORK_ID, new Date().toISOString(), count],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map((row) => row.enode));
        },
      );
    });
    enodes.forEach((enode) => {
      this.db?.run(
        `
        UPDATE enodes
        SET last_attempt_date = ?
        WHERE enode = ?;
        `,
        [new Date().toISOString(), enode],
        (err) => {
          if (err)
            logger.error('failed to update enode last seen', {
              enode,
              error: err?.message,
              stack: err?.stack,
            });
        },
      );
    });
    return enodes;
  }

  static addENodes(enodes: string[]) {
    enodes.forEach((enode) => {
      this.db?.run(
        `
        INSERT INTO enodes (enode, added_date, last_seen_date, last_attempt_date, consecutive_failures)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (enode) DO UPDATE SET last_seen_date = excluded.last_seen_date;
        `,
        [enode, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 0],
        (err) => {
          if (err)
            logger.error('failed to insert enode', {
              enode,
              error: err?.message,
              stack: err?.stack,
            });
        },
      );
    });
  }

  static addETHStatuses(statuses: ETHStatus[], sourceIp?: string) {
    statuses.forEach((status) => {
      if (status.data) {
        // only insert success for now
        this.db?.run(
          `
        INSERT INTO eth_statuses (
          enode,
          added_date,
          error_message,
          error_code,
          network_id,
          td,
          best_hash,
          genesis_hash,
          fork_hash,
          fork_next,
          client,
          source_ip
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
          [
            status.enode,
            new Date().toISOString(),
            status.error?.message,
            status.error?.code,
            status.data?.networkId,
            status.data?.td,
            status.data?.bestHash,
            status.data?.genesisHash,
            status.data?.fork?.hash,
            status.data?.fork?.next,
            status.data?.client,
            sourceIp,
          ],
          (err) => {
            if (err)
              logger.error('failed to insert eth status', {
                enode: status.enode,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );

        // update enode records
        this.db?.run(
          `
          UPDATE enodes
          SET last_status_date = ?,
              consecutive_failures = 0,
              disabled_until_date = null,
              network_id = ?
          WHERE enode = ?;
          `,
          [new Date().toISOString(), status.data.networkId, status.enode],
          (err) => {
            if (err)
              logger.error('failed to update enode data', {
                enode: status.enode,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );
      } else {
        this.db?.run(
          `
          UPDATE enodes
          SET consecutive_failures = consecutive_failures + 1
          WHERE enode = ?;
          `,
          [status.enode],
          (err) => {
            if (err)
              logger.error('failed to update enode failures', {
                enode: status.enode,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );
      }
    });
    // disable
    this.db?.all(
      `
        SELECT enode
        FROM enodes
        WHERE disabled_until_date IS NULL AND consecutive_failures >= 100
        LIMIT ?;
        `,
      [100],
      (err, rows) => {
        if (err) {
          logger.error('failed to disable nodes', {
            error: err?.message,
            stack: err?.stack,
          });
        } else {
          rows.forEach((row) => {
            this.db?.run(
              `
              UPDATE enodes
              SET disabled_until_date = ?,
                  consecutive_failures = 95
              WHERE enode = ?;
              `,
              [new Date(Date.now() + 60_000 * 30).toISOString(), row.enode],
              (errupdate) => {
                if (errupdate)
                  logger.error('failed to disable node', {
                    enode: row.enode,
                    error: errupdate?.message,
                    stack: errupdate?.stack,
                  });
              },
            );
          });
        }
      },
    );
  }

  static async getENRs(count = 100): Promise<string[]> {
    const enrs = await new Promise<string[]>((resolve, reject) => {
      this.db?.all(
        `
        SELECT enr
        FROM enrs
        WHERE (disabled_until_date IS NULL OR disabled_until_date < date(?))
        ORDER BY last_attempt_date DESC
        LIMIT ?;
        `,
        [new Date().toISOString(), count],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map((row) => row.enr));
        },
      );
    });
    enrs.forEach((enr) => {
      this.db?.run(
        `
        UPDATE enrs
        SET last_attempt_date = ?
        WHERE enr = ?;
        `,
        [new Date().toISOString(), enr],
        (err) => {
          if (err)
            logger.error('failed to update enr last seen', {
              enr,
              error: err?.message,
              stack: err?.stack,
            });
        },
      );
    });
    return enrs;
  }

  static addENRs(enrs: string[]) {
    enrs.forEach((enr) => {
      this.db?.run(
        `
        INSERT INTO enrs (enr, added_date, last_seen_date, last_attempt_date, consecutive_failures)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (enr) DO UPDATE SET last_seen_date = excluded.last_seen_date;
        `,
        [enr, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 0],
        (err) => {
          if (err)
            logger.error('failed to insert enr', {
              enr,
              error: err?.message,
              stack: err?.stack,
            });
        },
      );
    });
  }

  static addPhase0Statuses(statuses: Phase0Status[], sourceIp?: string) {
    statuses.forEach((status) => {
      if (status.data) {
        // only insert success for now
        this.db?.run(
          `
          INSERT INTO phase0_statuses (
            enr,
            added_date,
            error_message,
            error_code,
            fork_digest,
            finalized_root,
            finalized_epoch,
            head_root,
            head_slot,
            source_ip
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          [
            status.enr,
            new Date().toISOString(),
            status.error?.message,
            status.error?.code,
            status.data?.forkDigest,
            status.data?.finalizedRoot,
            status.data?.finalizedEpoch,
            status.data?.headRoot,
            status.data?.headSlot,
            sourceIp,
          ],
          (err) => {
            if (err)
              logger.error('failed to insert phase0 status', {
                enr: status.enr,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );

        // update enr records
        this.db?.run(
          `
          UPDATE enrs
          SET last_status_date = ?,
              consecutive_failures = 0,
              disabled_until_date = null
          WHERE enr = ?;
          `,
          [new Date().toISOString(), status.enr],
          (err) => {
            if (err)
              logger.error('failed to update enr data', {
                enr: status.enr,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );
      } else {
        this.db?.run(
          `
          UPDATE enrs
          SET consecutive_failures = consecutive_failures + 1
          WHERE enr = ?;
          `,
          [status.enr],
          (err) => {
            if (err)
              logger.error('failed to update enr failures', {
                enr: status.enr,
                error: err?.message,
                stack: err?.stack,
              });
          },
        );
      }
    });
    // disable
    this.db?.all(
      `
        SELECT enr
        FROM enrs
        WHERE disabled_until_date IS NULL AND consecutive_failures >= 100
        LIMIT ?;
        `,
      [100],
      (err, rows) => {
        if (err) {
          logger.error('failed to disable enrs', {
            error: err?.message,
            stack: err?.stack,
          });
        } else {
          rows.forEach((row) => {
            this.db?.run(
              `
              UPDATE enrs
              SET disabled_until_date = ?,
                  consecutive_failures = 95
              WHERE enr = ?;
              `,
              [new Date(Date.now() + 60_000 * 30).toISOString(), row.enr],
              (errupdate) => {
                if (errupdate)
                  logger.error('failed to disable node', {
                    enr: row.enr,
                    error: errupdate?.message,
                    stack: errupdate?.stack,
                  });
              },
            );
          });
        }
      },
    );
  }
}
