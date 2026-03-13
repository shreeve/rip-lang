import tls from "node:tls";
import {
  assertOpenSsl,
  cleanupDir,
  createSelfSigned,
  mkTempDir,
  queryCertCn,
  sleep,
  startTlsServer,
} from "./common.mjs";

const result = {
  spike: "sni-capability",
  baselineWorks: false,
  strategies: [],
  dynamicSniSupported: false,
  winner: null,
};

const runStrategy = async (name, tlsOptionsBuilder, certA, certB) => {
  const entry = { name, serverStarted: false, cnOne: null, cnTwo: null, error: null };
  let server = null;
  try {
    const tlsOptions = tlsOptionsBuilder(certA, certB);
    server = startTlsServer(tlsOptions);
    entry.serverStarted = true;
    await sleep(200);
    entry.cnOne = await queryCertCn(server.port, "one.test");
    entry.cnTwo = await queryCertCn(server.port, "two.test");
    if (entry.cnOne === "one.test" && entry.cnTwo === "two.test") {
      result.dynamicSniSupported = true;
      result.winner = name;
    }
  } catch (error) {
    entry.error = error?.message || String(error);
  } finally {
    try {
      server?.stop(true);
    } catch {
      // ignore
    }
  }
  result.strategies.push(entry);
};

const main = async () => {
  assertOpenSsl();
  const dir = mkTempDir();
  try {
    const certA = createSelfSigned(dir, "one", "one.test");
    const certB = createSelfSigned(dir, "two", "two.test");

    // Baseline: static cert should return same CN for all server names.
    let baseline = null;
    try {
      baseline = startTlsServer({ key: certA.keyPem, cert: certA.certPem });
      await sleep(200);
      const cn = await queryCertCn(baseline.port, "whatever.test");
      result.baselineWorks = cn === "one.test";
    } finally {
      try {
        baseline?.stop(true);
      } catch {
        // ignore
      }
    }

    await runStrategy(
      "node-style-SNICallback",
      (a, b) => ({
        key: a.keyPem,
        cert: a.certPem,
        SNICallback: (serverName, cb) => {
          const ctx = tls.createSecureContext(
            serverName === "two.test"
              ? { key: b.keyPem, cert: b.certPem }
              : { key: a.keyPem, cert: a.certPem },
          );
          if (cb) cb(null, ctx);
          return ctx;
        },
      }),
      certA,
      certB,
    );

    await runStrategy(
      "serverName-function",
      (a, b) => ({
        key: a.keyPem,
        cert: a.certPem,
        serverName: (serverName) =>
          serverName === "two.test"
            ? { key: b.keyPem, cert: b.certPem }
            : { key: a.keyPem, cert: a.certPem },
      }),
      certA,
      certB,
    );

    console.log(JSON.stringify(result, null, 2));
    if (result.dynamicSniSupported) {
      console.log("PASS: dynamic SNI certificate selection works.");
      process.exit(0);
    }
    console.log("FAIL: no tested strategy yielded dynamic SNI certificate selection.");
    process.exit(1);
  } finally {
    cleanupDir(dir);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
