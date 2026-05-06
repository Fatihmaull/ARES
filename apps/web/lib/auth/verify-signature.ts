import bs58 from "bs58";
import nacl from "tweetnacl";

export function verifyEd25519WalletSignature(params: {
  walletAddressBase58: string;
  messageUtf8: string;
  signatureBase58: string;
}): boolean {
  try {
    const pkBytes = bs58.decode(params.walletAddressBase58);
    const sigBytes = bs58.decode(params.signatureBase58);
    const msgBytes = new TextEncoder().encode(params.messageUtf8);
    if (pkBytes.length !== nacl.sign.publicKeyLength) return false;
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    return nacl.sign.detached.verify(msgBytes, sigBytes, pkBytes);
  } catch {
    return false;
  }
}
