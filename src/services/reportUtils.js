const db = require("../config");

function countPlaceholders(sql) {
  if (!sql || typeof sql !== "string") return 0;
  let inSingle = false;
  let inDouble = false;
  let count = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      if (!(i > 0 && sql[i - 1] === "\\")) inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      if (!(i > 0 && sql[i - 1] === "\\")) inDouble = !inDouble;
    } else if (ch === "?" && !inSingle && !inDouble) {
      count++;
    }
  }
  return count;
}

function sanitizeSql(sql) {
  if (!sql || typeof sql !== "string") return sql;
  let s = sql;

  s = s.replace(/\s*,\s*(FROM|WHERE|ORDER\s+BY|GROUP\s+BY|LIMIT)\b/gi, " $1");
  s = s.replace(/,\s*\)/g, ")");
  s = s.replace(/,{2,}/g, ",");
  s = s.replace(/\s+/g, " ");

  return s;
}

function expandArrayParams(sql, params) {
  if (!Array.isArray(params) || params.length === 0) return { sql, params };

  let newSql = sql;
  const newParams = [];

  function findNextQuestionIndex(startIdx = 0) {
    let inSingle = false;
    let inDouble = false;
    for (let i = startIdx; i < newSql.length; i++) {
      const ch = newSql[i];
      if (ch === "'" && !inDouble) {
        if (!(i > 0 && newSql[i - 1] === "\\")) inSingle = !inSingle;
      } else if (ch === '"' && !inSingle) {
        if (!(i > 0 && newSql[i - 1] === "\\")) inDouble = !inDouble;
      } else if (ch === "?" && !inSingle && !inDouble) {
        return i;
      }
    }
    return -1;
  }

  let searchFrom = 0;
  for (let p of params) {
    const qIdx = findNextQuestionIndex(searchFrom);
    if (qIdx === -1) {
      if (Array.isArray(p)) {
        for (const v of p) newParams.push(v);
      } else {
        newParams.push(p);
      }
      continue;
    }

    if (Array.isArray(p)) {
      if (p.length === 0) {
        newSql = newSql.slice(0, qIdx) + "(NULL)" + newSql.slice(qIdx + 1);
        searchFrom = qIdx + 6;
      } else {
        const marks = p.map(() => "?").join(", ");
        newSql =
          newSql.slice(0, qIdx) + "(" + marks + ")" + newSql.slice(qIdx + 1);
        for (const v of p) newParams.push(v);
        searchFrom = qIdx + marks.length + 2;
      }
    } else {
      newParams.push(p);
      searchFrom = qIdx + 1;
    }
  }

  return { sql: newSql, params: newParams };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRows(rawSql, rawParams = []) {
  if (!rawSql || typeof rawSql !== "string") {
    console.error("[reportUtils] fetchRows called with invalid SQL:", rawSql);
    throw new Error(
      "reportService: SQL query is missing or invalid. Check ../constants/reportQueries.js for missing keys."
    );
  }
  if (
    !db ||
    (typeof db.query !== "function" && typeof db.execute !== "function")
  ) {
    throw new Error("DB not available. Check ../config export.");
  }

  let params = Array.isArray(rawParams) ? [...rawParams] : [rawParams];
  let sql = rawSql;

  try {
    sql = sanitizeSql(sql);
  } catch (e) {}

  try {
    const expanded = expandArrayParams(sql, params);
    sql = expanded.sql;
    params = expanded.params;
  } catch (e) {
    console.warn("[reportUtils] expandArrayParams failed:", e && e.message);
  }

  try {
    const placeholderCount = countPlaceholders(sql);
    if (placeholderCount > params.length) {
      const before = params.length;
      const toPad = placeholderCount - params.length;
      for (let i = 0; i < toPad; i++) params.push(null);
      console.debug(
        `[reportUtils] padded params to match placeholders { placeholderCount: ${placeholderCount}, paramsLength: ${before} }`
      );
    }
  } catch (e) {}

  const maxRetries = 2;
  let attempt = 0;
  let lastErr = null;

  while (attempt <= maxRetries) {
    try {
      const t0 = Date.now();

      let res;
      if (typeof db.query === "function") {
        const maybePromise = db.query(sql, params);
        if (maybePromise && typeof maybePromise.then === "function") {
          res = await maybePromise;
        } else {
          res = await new Promise((resolve, reject) => {
            db.query(sql, params, (err, rows, fields) => {
              if (err) return reject(err);
              resolve([rows, fields]);
            });
          });
        }
      } else if (typeof db.execute === "function") {
        const maybePromise = db.execute(sql, params);
        if (maybePromise && typeof maybePromise.then === "function") {
          res = await maybePromise;
        } else {
          res = await new Promise((resolve, reject) => {
            db.execute(sql, params, (err, rows, fields) => {
              if (err) return reject(err);
              resolve([rows, fields]);
            });
          });
        }
      } else {
        throw new Error("DB client has no query/execute method");
      }

      const took = Date.now() - t0;
      if (Array.isArray(res) && res.length > 0 && Array.isArray(res[0])) {
        return res[0];
      }
      if (Array.isArray(res)) {
        return res;
      }
      if (res && typeof res === "object" && Array.isArray(res.rows)) {
        return res.rows;
      }
      return [];
    } catch (err) {
      lastErr = err;
      const msg =
        err && (err.message || err.code)
          ? err.message || err.code
          : String(err);
      const transient = /ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND/i.test(msg);
      attempt++;
      if (!transient || attempt > maxRetries) {
        const safeParams = Array.isArray(params)
          ? params.map((p) => {
              try {
                if (p === null) return null;
                if (typeof p === "string" && p.length > 200)
                  return `${p.slice(0, 200)}...`;
                return p;
              } catch (e) {
                return String(p);
              }
            })
          : params;
        const enriched = new Error(
          `[reportUtils] fetchRows error: ${
            err && err.message ? err.message : String(err)
          }\nSQL: \n${sql}\n -- params: ${JSON.stringify(safeParams)}`
        );
        enriched.stack = err && err.stack ? err.stack : enriched.stack;
        console.error(enriched.message);
        throw enriched;
      } else {
        const backoff = 200 * attempt;
        console.warn(
          `[reportUtils] transient DB error (${msg}), retrying ${attempt}/${maxRetries} after ${backoff}ms`
        );
        await sleep(backoff);
        continue;
      }
    }
  }

  throw lastErr || new Error("Unknown DB error");
}

function coerceToString(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val)) val = val[val.length - 1];
  try {
    const s = String(val);
    return s.length ? s : fallback;
  } catch (e) {
    return fallback;
  }
}

module.exports = {
  fetchRows,
  coerceToString,
};
