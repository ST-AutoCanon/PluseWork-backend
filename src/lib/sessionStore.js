// ./src/lib/sessionStore.js
const session = require("express-session");
const Redis = require("ioredis");
const connectRedis = require("connect-redis");

const RedisStore = connectRedis(session); // works with connect-redis@6

// ioredis common options - limit retries and add retry strategy
const commonIoredisOptions = {
  maxRetriesPerRequest: 5,
  retryStrategy(times) {
    return Math.min(50 * Math.pow(2, times), 2000); // backoff
  },
  enableOfflineQueue: true,
};

const redisUrl = process.env.REDIS_URL || null;

let redisClient = null;
let storeInstance = null;
let initPromise = null;

async function initSessionStore() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (!redisUrl) throw new Error("REDIS_URL not set");

      // create ioredis client
      redisClient = new Redis(redisUrl, commonIoredisOptions);

      // error handler to avoid unhandled exceptions
      redisClient.on("error", (err) =>
        console.error(
          "[ioredis] error:",
          err && err.message ? err.message : err
        )
      );
      redisClient.on("connect", () => console.info("[ioredis] connecting..."));
      redisClient.on("ready", () => console.info("[ioredis] ready"));
      redisClient.on("end", () => console.warn("[ioredis] connection closed"));

      // quick ping to ensure reachable
      await Promise.race([
        redisClient.ping(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("PING_TIMEOUT")), 5000)
        ),
      ]);

      // create store
      storeInstance = new RedisStore({ client: redisClient });
      return { store: storeInstance, redisClient, usingRedis: true };
    } catch (err) {
      console.error(
        "[sessionStore] Redis init failed:",
        err && err.message ? err.message : err
      );
      // if redis fails, bubble up the error so caller can fallback or stop
      throw err;
    }
  })();
  return initPromise;
}

function createSessionStore() {
  // return a promise that resolves to the store
  return initSessionStore().then((r) => r.store);
}

module.exports = { createSessionStore, _initPromise: initSessionStore };
