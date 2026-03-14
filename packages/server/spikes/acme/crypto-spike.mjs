/**
 * ACME Crypto Spike — validate crypto helpers against Let's Encrypt staging
 *
 * Tests:
 * 1. EC P-256 key generation and JWK export
 * 2. JWK thumbprint computation
 * 3. JWS signing and format
 * 4. Directory fetch from Let's Encrypt staging
 * 5. Nonce acquisition
 * 6. Account creation (signed request round-trip)
 *
 * Run: bun packages/server/spikes/acme/crypto-spike.mjs
 */

import { generateKeyPairSync, createSign, createHash, createPrivateKey } from "node:crypto";

const STAGING_DIR = "https://acme-staging-v02.api.letsencrypt.org/directory";

const results = {
  spike: "acme-crypto",
  keyGeneration: null,
  jwkExport: null,
  thumbprint: null,
  jwsSigning: null,
  directoryFetch: null,
  nonceAcquisition: null,
  accountCreation: null,
  errors: [],
};

// --- Helpers (mirror acme/crypto.rip logic) ---

function b64url(buf) {
  const b = typeof buf === "string" ? Buffer.from(buf) : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function derToRaw(derSig) {
  let offset = 2;
  const rLen = derSig[offset + 1];
  const r = derSig.slice(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  const sLen = derSig[offset + 1];
  const s = derSig.slice(offset + 2, offset + 2 + sLen);
  function pad(buf, len) {
    if (buf.length > len) return buf.slice(buf.length - len);
    if (buf.length === len) return buf;
    const out = Buffer.alloc(len);
    buf.copy(out, len - buf.length);
    return out;
  }
  return Buffer.concat([pad(r, 32), pad(s, 32)]);
}

// --- Test 1: Key generation ---
let keyPair;
try {
  keyPair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  results.keyGeneration = true;
} catch (e) {
  results.keyGeneration = false;
  results.errors.push(`Key generation failed: ${e.message}`);
}

// --- Test 2: JWK export ---
let publicJwk;
try {
  const jwk = keyPair.publicKey.export({ format: "jwk" });
  publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  results.jwkExport = {
    hasKty: publicJwk.kty === "EC",
    hasCrv: publicJwk.crv === "P-256",
    hasX: typeof publicJwk.x === "string" && publicJwk.x.length > 0,
    hasY: typeof publicJwk.y === "string" && publicJwk.y.length > 0,
    ok: true,
  };
} catch (e) {
  results.jwkExport = { ok: false };
  results.errors.push(`JWK export failed: ${e.message}`);
}

// --- Test 3: Thumbprint ---
let tp;
try {
  const canonical = JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y });
  const hash = createHash("sha256").update(canonical).digest();
  tp = b64url(hash);
  results.thumbprint = {
    value: tp,
    length: tp.length,
    ok: tp.length === 43, // SHA-256 = 32 bytes = 43 base64url chars
  };
} catch (e) {
  results.thumbprint = { ok: false };
  results.errors.push(`Thumbprint failed: ${e.message}`);
}

// --- Test 4: JWS signing ---
function signJws(payload, url, nonce, privateKey, publicJwk, kid) {
  const protectedHeader = kid
    ? { alg: "ES256", kid, nonce, url }
    : { alg: "ES256", jwk: publicJwk, nonce, url };

  const protectedB64 = b64url(JSON.stringify(protectedHeader));
  const payloadB64 = payload === "" ? "" : b64url(JSON.stringify(payload));
  const sigInput = `${protectedB64}.${payloadB64}`;

  const signer = createSign("SHA256");
  signer.update(sigInput);
  const derSig = signer.sign(keyPair.privateKey);
  const rawSig = derToRaw(derSig);

  return JSON.stringify({
    protected: protectedB64,
    payload: payloadB64,
    signature: b64url(rawSig),
  });
}

try {
  const testJws = signJws({ test: true }, "https://example.com/test", "fake-nonce", keyPair.privateKey, publicJwk);
  const parsed = JSON.parse(testJws);
  results.jwsSigning = {
    hasProtected: typeof parsed.protected === "string" && parsed.protected.length > 0,
    hasPayload: typeof parsed.payload === "string" && parsed.payload.length > 0,
    hasSignature: typeof parsed.signature === "string" && parsed.signature.length > 0,
    signatureLength: Buffer.from(parsed.signature.replace(/-/g, "+").replace(/_/g, "/"), "base64").length,
    ok: true,
  };
} catch (e) {
  results.jwsSigning = { ok: false };
  results.errors.push(`JWS signing failed: ${e.message}`);
}

// --- Test 5: Directory fetch ---
let directory;
try {
  const res = await fetch(STAGING_DIR);
  directory = await res.json();
  results.directoryFetch = {
    hasNewNonce: typeof directory.newNonce === "string",
    hasNewAccount: typeof directory.newAccount === "string",
    hasNewOrder: typeof directory.newOrder === "string",
    ok: true,
  };
} catch (e) {
  results.directoryFetch = { ok: false };
  results.errors.push(`Directory fetch failed: ${e.message}`);
}

// --- Test 6: Nonce acquisition ---
let nonce;
try {
  const res = await fetch(directory.newNonce, { method: "HEAD" });
  nonce = res.headers.get("replay-nonce");
  results.nonceAcquisition = {
    hasNonce: typeof nonce === "string" && nonce.length > 0,
    nonceLength: nonce?.length,
    ok: nonce?.length > 0,
  };
} catch (e) {
  results.nonceAcquisition = { ok: false };
  results.errors.push(`Nonce acquisition failed: ${e.message}`);
}

// --- Test 7: Account creation (real signed request to staging) ---
try {
  const body = signJws(
    { termsOfServiceAgreed: true },
    directory.newAccount,
    nonce,
    keyPair.privateKey,
    publicJwk
  );

  const res = await fetch(directory.newAccount, {
    method: "POST",
    headers: { "content-type": "application/jose+json" },
    body,
  });

  const status = res.status;
  const replayNonce = res.headers.get("replay-nonce");
  const location = res.headers.get("location");
  let resBody;
  try {
    resBody = await res.json();
  } catch {
    resBody = await res.text();
  }

  results.accountCreation = {
    httpStatus: status,
    hasReplayNonce: typeof replayNonce === "string" && replayNonce.length > 0,
    hasLocation: typeof location === "string" && location.length > 0,
    accountStatus: resBody?.status,
    ok: status === 200 || status === 201,
    error: status >= 400 ? resBody : null,
  };
} catch (e) {
  results.accountCreation = { ok: false };
  results.errors.push(`Account creation failed: ${e.message}`);
}

// --- Output ---

console.log(JSON.stringify(results, null, 2));

const allOk = results.keyGeneration
  && results.jwkExport?.ok
  && results.thumbprint?.ok
  && results.jwsSigning?.ok
  && results.directoryFetch?.ok
  && results.nonceAcquisition?.ok
  && results.accountCreation?.ok;

console.log(`\n=== ${allOk ? "ALL TESTS PASSED" : "SOME TESTS FAILED"} ===`);
process.exit(allOk ? 0 : 1);
