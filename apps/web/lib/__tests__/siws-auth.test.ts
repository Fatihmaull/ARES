import test from "node:test";
import assert from "node:assert/strict";
import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  buildChallengeMessage,
  extractExpirationFromSignedMessage,
  extractNonceFromSignedMessage,
} from "../auth/siws-message";
import { verifyEd25519WalletSignature } from "../auth/verify-signature";

test("SIWS helpers round-trip nonce + expiry lines", () => {
  const msg = buildChallengeMessage({
    nonce: "abc-123",
    domain: "ares.test",
    statement: "Sign in to ARES",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:05:00.000Z",
  });
  assert.equal(extractNonceFromSignedMessage(msg), "abc-123");
  const exp = extractExpirationFromSignedMessage(msg);
  assert.ok(exp);
  assert.equal(exp?.toISOString(), "2026-01-01T00:05:00.000Z");
});

test("verifyEd25519WalletSignature accepts detached signatures", () => {
  const kp = nacl.sign.keyPair();
  const wallet = bs58.encode(kp.publicKey);
  const messageUtf8 = buildChallengeMessage({
    nonce: "n",
    domain: "localhost",
    statement: "Sign in to ARES",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const sig = nacl.sign.detached(new TextEncoder().encode(messageUtf8), kp.secretKey);
  const signatureBase58 = bs58.encode(sig);

  assert.ok(
    verifyEd25519WalletSignature({
      walletAddressBase58: wallet,
      messageUtf8,
      signatureBase58,
    }),
  );
});

test("verifyEd25519WalletSignature rejects tampered message", () => {
  const kp = nacl.sign.keyPair();
  const wallet = bs58.encode(kp.publicKey);
  const msg = "hello";
  const sig = nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey);
  assert.ok(
    !verifyEd25519WalletSignature({
      walletAddressBase58: wallet,
      messageUtf8: "hallo",
      signatureBase58: bs58.encode(sig),
    }),
  );
});
