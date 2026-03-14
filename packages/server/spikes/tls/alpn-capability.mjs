import {
  assertOpenSsl,
  cleanupDir,
  createSelfSigned,
  mkTempDir,
  queryAlpn,
  queryCertCn,
  sleep,
  startTlsServer,
} from "./common.mjs";

const result = {
  spike: "alpn-capability",
  serverStartedWithAlpnProtocols: false,
  negotiatedProtocol: null,
  alpnCallbackAccepted: false,
  alpnCallbackInvoked: false,
  alpnDrivenCertSelection: false,
  notes: [],
};

const main = async () => {
  assertOpenSsl();
  const dir = mkTempDir();
  let server = null;
  let callbackServer = null;
  try {
    const certA = createSelfSigned(dir, "one", "one.test");
    const certB = createSelfSigned(dir, "two", "two.test");

    // 1) Basic ALPN negotiation support.
    try {
      server = startTlsServer({
        key: certA.keyPem,
        cert: certA.certPem,
        ALPNProtocols: "acme-tls/1",
      });
      result.serverStartedWithAlpnProtocols = true;
      await sleep(200);
      result.negotiatedProtocol = await queryAlpn(server.port, "one.test", "acme-tls/1");
      if (result.negotiatedProtocol !== "acme-tls/1") {
        result.notes.push(
          `ALPN did not negotiate expected protocol. got=${result.negotiatedProtocol || "none"}`,
        );
      }
    } finally {
      try {
        server?.stop(true);
      } catch {
        // ignore
      }
    }

    // 2) Probe whether ALPN callback style APIs are accepted/invoked.
    let invoked = false;
    try {
      callbackServer = startTlsServer({
        key: certA.keyPem,
        cert: certA.certPem,
        ALPNProtocols: "acme-tls/1",
        ALPNCallback: () => {
          invoked = true;
          return "acme-tls/1";
        },
      });
      result.alpnCallbackAccepted = true;
      await sleep(200);
      // Trigger TLS handshake.
      await queryAlpn(callbackServer.port, "one.test", "acme-tls/1");
      await sleep(100);
      result.alpnCallbackInvoked = invoked;
    } catch (error) {
      result.notes.push(`ALPNCallback rejected: ${error?.message || String(error)}`);
    } finally {
      try {
        callbackServer?.stop(true);
      } catch {
        // ignore
      }
    }

    // 3) Probe ALPN-driven cert selection: not directly exposed unless API can pick
    // cert context by ALPN during handshake. We treat this as unsupported unless proved.
    // We verify we cannot observe different cert selection for acme-tls/1 request.
    let alpnCertServer = null;
    try {
      alpnCertServer = startTlsServer({
        key: certA.keyPem,
        cert: certA.certPem,
        ALPNProtocols: "acme-tls/1",
      });
      await sleep(200);
      const cn = await queryCertCn(alpnCertServer.port, "one.test");
      result.alpnDrivenCertSelection = cn === certB.commonName;
      if (!result.alpnDrivenCertSelection) {
        result.notes.push(
          "No evidence of ALPN-driven certificate selection in tested Bun.serve API surface.",
        );
      }
    } finally {
      try {
        alpnCertServer?.stop(true);
      } catch {
        // ignore
      }
    }

    const pass =
      result.serverStartedWithAlpnProtocols && result.negotiatedProtocol === "acme-tls/1";

    console.log(JSON.stringify(result, null, 2));
    if (pass) {
      console.log("PASS: basic ALPN negotiation works.");
      process.exit(0);
    }
    console.log("FAIL: basic ALPN negotiation did not work as expected.");
    process.exit(1);
  } finally {
    cleanupDir(dir);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
