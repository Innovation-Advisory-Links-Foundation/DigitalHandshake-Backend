import pino from "pino";

/**
 * Pino logger options configuration.
 */
const l = pino({
  name: process.env.APP_ID || "digital-handshake-backend",
  level: process.env.LOG_LEVEL || "debug",
});

export default l;
