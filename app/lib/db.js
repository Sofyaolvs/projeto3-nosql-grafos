// Conexões com os dois bancos (os mesmos do docker-compose da pasta entrega2).
const neo4j = require("neo4j-driver");
const mysql = require("mysql2/promise");

const cfg = {
  neo4j: { url: process.env.NEO4J_URL || "bolt://localhost:7687", user: process.env.NEO4J_USER || "neo4j", senha: process.env.NEO4J_SENHA || "rotas12345" },
  mysql: { host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3307), user: "root", password: process.env.MYSQL_SENHA || "rotas12345", database: "rotas" },
};

let driver, pool;
function neo() {
  // disableLosslessIntegers: inteiros do Neo4j chegam como números JavaScript
  driver ??= neo4j.driver(cfg.neo4j.url, neo4j.auth.basic(cfg.neo4j.user, cfg.neo4j.senha), { disableLosslessIntegers: true });
  return driver;
}
function my() {
  pool ??= mysql.createPool({ ...cfg.mysql, connectionLimit: 4, decimalNumbers: true, charset: "utf8mb4" });
  return pool;
}
async function fechar() { if (driver) await driver.close(); if (pool) await pool.end(); driver = pool = undefined; }

// mede o tempo (ms) de uma função assíncrona; erros de tempo limite viram status "timeout"
async function medir(fn) {
  const t0 = process.hrtime.bigint();
  try {
    const valor = await fn();
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, status: "ok", ...valor };
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const msg = String(e && (e.code || e.message));
    if (/TransactionTimedOut|ER_QUERY_TIMEOUT|3024|maximum statement execution time|timeout/i.test(msg + " " + (e.message || ""))) return { ms, status: "timeout" };
    return { ms, status: "erro", erro: e.message };
  }
}

module.exports = { neo, my, fechar, medir, cfg };
