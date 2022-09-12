import logger from '@savid/logger';

import app from '#app/app';

logger.info('starting status collector service');

app().catch((err) => {
  logger.error('app error', { error: err.toString(), stack: err.stack });
});
