import logger from '@savid/logger';
import Shutdown from '@savid/shutdown';

import Admin from '#app/admin';
import Server from '#app/server';
import Store from '#app/store';

export default async () => {
  Admin.init();
  Store.init();
  Server.init();
  Admin.healthy = true;
  // graceful shutdown
  Shutdown.register('app', async (error) => {
    logger.info('app shutting down');
    Admin.healthy = false;
    if (error)
      logger.error('app shutdown error', {
        error: error.toString(),
        name: error.name,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
      });
    await Server.shutdown();
    await Admin.shutdown();
    logger.info('app finished shutting down');
  });

  Shutdown.on('error', ({ error, register }) =>
    logger.error('shutdown registered handler error', {
      error: error.toString(),
      stack: error.stack,
      register,
    }),
  );
};
