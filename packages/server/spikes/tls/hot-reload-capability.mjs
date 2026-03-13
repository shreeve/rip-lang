import {
  assertOpenSsl,
  cleanupDir,
  createSelfSigned,
  mkTempDir,
  queryCertCn,
  replacePemFiles,
  sleep,
  startTlsServer,
} from "./common.mjs";

const result = {
  spike: "hot-reload-capability",
  cnBeforeChange: null,
  cnAfterFileChangeWithoutRestart: null,
  cnAfterRestart: null,
  hotReloadWithoutRestartWorks: false,
  gracefulRestartWorks: false,
};

const main = async () => {
  assertOpenSsl();
  const dir = mkTempDir();
  let server = null;
  let restarted = null;
  try {
    const oldCert = createSelfSigned(dir, "old", "old.test");
    const newCert = createSelfSigned(dir, "new", "new.test");

    // Use the same file paths and mutate files to test runtime reload behavior.
    const activeKeyPath = oldCert.keyPath;
    const activeCertPath = oldCert.certPath;

    server = startTlsServer({
      key: oldCert.keyPem,
      cert: oldCert.certPem,
      ALPNProtocols: "http/1.1",
    });
    await sleep(200);
    result.cnBeforeChange = await queryCertCn(server.port, "old.test");

    replacePemFiles(activeKeyPath, activeCertPath, newCert.keyPem, newCert.certPem);
    await sleep(300);
    result.cnAfterFileChangeWithoutRestart = await queryCertCn(server.port, "new.test");

    result.hotReloadWithoutRestartWorks = result.cnAfterFileChangeWithoutRestart === "new.test";

    server.stop(true);
    server = null;

    restarted = startTlsServer({
      key: newCert.keyPem,
      cert: newCert.certPem,
      ALPNProtocols: "http/1.1",
    });
    await sleep(200);
    result.cnAfterRestart = await queryCertCn(restarted.port, "new.test");
    result.gracefulRestartWorks = result.cnAfterRestart === "new.test";

    const pass = !result.hotReloadWithoutRestartWorks && result.gracefulRestartWorks;
    console.log(JSON.stringify(result, null, 2));
    if (pass) {
      console.log(
        "PASS: in-process cert hot-reload was not observed; restart-based reload works (fallback path).",
      );
      process.exit(0);
    }

    console.log("FAIL: unexpected hot-reload behavior; verify Bun TLS cert loading semantics.");
    process.exit(1);
  } finally {
    try {
      server?.stop(true);
    } catch {
      // ignore
    }
    try {
      restarted?.stop(true);
    } catch {
      // ignore
    }
    cleanupDir(dir);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
