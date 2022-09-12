const dev = process.env.NODE_ENV === 'development';

export const LOG_LEVEL: string = process.env.LOG_LEVEL || (dev ? 'debug' : 'warn');

export const PORT: string = process.env.PORT ?? '8080';
export const PORT_ADMIN: string = process.env.PORT_ADMIN ?? '8081';

export const { DB_PATH } = process.env;
export const { SHARED_SECRET } = process.env;

export const NETWORK_ID: string = process.env.NETWORK_ID ?? '1';
