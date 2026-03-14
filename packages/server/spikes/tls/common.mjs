import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runShell = (command) => {
  const proc = Bun.spawnSync(["sh", "-lc", command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode ?? 1,
    stdout: Buffer.from(proc.stdout || []).toString("utf8"),
    stderr: Buffer.from(proc.stderr || []).toString("utf8"),
  };
};

const assertOpenSsl = () => {
  const r = runShell("openssl version");
  if (r.exitCode !== 0) {
    throw new Error(`OpenSSL is required for spikes.\n${r.stderr || r.stdout}`);
  }
};

const createSelfSigned = (dir, baseName, commonName) => {
  const keyPath = join(dir, `${baseName}.key.pem`);
  const certPath = join(dir, `${baseName}.cert.pem`);
  const cmd = [
    "openssl req -x509 -newkey rsa:2048 -sha256 -nodes",
    "-days 1",
    `-keyout "${keyPath}"`,
    `-out "${certPath}"`,
    `-subj "/CN=${commonName}"`,
    ">/dev/null 2>&1",
  ].join(" ");
  const r = runShell(cmd);
  if (r.exitCode !== 0) {
    throw new Error(`Failed to create certificate for ${commonName}\n${r.stderr || r.stdout}`);
  }
  return {
    keyPath,
    certPath,
    keyPem: readFileSync(keyPath, "utf8"),
    certPem: readFileSync(certPath, "utf8"),
    commonName,
  };
};

const mkTempDir = (prefix = "rip-tls-spike-") => mkdtempSync(join(tmpdir(), prefix));

const cleanupDir = (dir) => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // no-op
  }
};

const queryCertCn = (port, serverName) =>
  new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const socket = tls.connect(
      {
        host: "127.0.0.1",
        port,
        servername: serverName,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        done(cert?.subject?.CN || null);
        socket.end();
      },
    );
    socket.setTimeout(2500, () => {
      done(null);
      socket.destroy();
    });
    socket.once("error", () => done(null));
    socket.once("close", () => done(null));
  });

const queryAlpn = (port, serverName, protocol = "acme-tls/1") =>
  new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const socket = tls.connect(
      {
        host: "127.0.0.1",
        port,
        servername: serverName,
        rejectUnauthorized: false,
        ALPNProtocols: [protocol],
      },
      () => {
        done(socket.alpnProtocol || null);
        socket.end();
      },
    );
    socket.setTimeout(2500, () => {
      done(null);
      socket.destroy();
    });
    socket.once("error", () => done(null));
    socket.once("close", () => done(null));
  });

const startTlsServer = (tlsOptions, fetchHandler = () => new Response("ok")) => {
  return Bun.serve({
    port: 0,
    tls: tlsOptions,
    fetch: fetchHandler,
  });
};

const replacePemFiles = (targetKeyPath, targetCertPath, sourceKeyPem, sourceCertPem) => {
  writeFileSync(targetKeyPath, sourceKeyPem, "utf8");
  writeFileSync(targetCertPath, sourceCertPem, "utf8");
};

export {
  assertOpenSsl,
  cleanupDir,
  createSelfSigned,
  mkTempDir,
  queryAlpn,
  queryCertCn,
  replacePemFiles,
  runShell,
  sleep,
  startTlsServer,
};
