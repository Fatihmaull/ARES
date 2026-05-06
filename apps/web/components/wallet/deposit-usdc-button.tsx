"use client";

import { createMemoInstruction } from "@solana/spl-memo";
import {
  createAssociatedTokenAccountIdempotentInstructionWithDerivation,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { cn } from "@/lib/utils";

function solscanTxUrl(signature: string): string {
  const net = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim();
  const cluster =
    net === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(net || "devnet")}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

function solanaPayTransferHref(opts: {
  recipient: string;
  amountUi: number;
  splTokenMint: string;
  memo: string;
}): string {
  const q = new URLSearchParams();
  q.set("amount", String(opts.amountUi));
  q.set("spl-token", opts.splTokenMint);
  q.set("memo", opts.memo);
  q.set("label", "ARES credits top-up");
  return `solana:${opts.recipient}?${q.toString()}`;
}

export type DepositUsdcButtonProps = {
  sessionWallet: string;
  treasury: string;
  mintUsdc: string;
  memo: string;
  usdc: number;
  className?: string;
  onSent?: (signature: string) => void;
};

export function DepositUsdcButton({
  sessionWallet,
  treasury,
  mintUsdc,
  memo,
  usdc,
  className,
  onSent,
}: DepositUsdcButtonProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const connectedPk = publicKey?.toBase58() ?? null;
  const walletMatchesSession =
    Boolean(connectedPk && connectedPk === sessionWallet.trim());

  const payHref = useMemo(
    () =>
      solanaPayTransferHref({
        recipient: treasury,
        amountUi: usdc,
        splTokenMint: mintUsdc,
        memo,
      }),
    [treasury, usdc, mintUsdc, memo],
  );

  const sendDeposit = useCallback(async () => {
    setErr(null);
    setLastSig(null);
    if (!publicKey || !walletMatchesSession) {
      setErr("Connect the same wallet as your session, then try again.");
      return;
    }

    let treasuryPk: PublicKey;
    let mintPk: PublicKey;
    try {
      treasuryPk = new PublicKey(treasury);
      mintPk = new PublicKey(mintUsdc);
    } catch {
      setErr("Invalid treasury or mint address from server.");
      return;
    }

    setBusy(true);
    try {
      const mintInfo = await getMint(connection, mintPk);
      const decimals = mintInfo.decimals;
      const factor = 10 ** decimals;
      const amount = BigInt(Math.round(usdc * factor));

      const userAta = getAssociatedTokenAddressSync(mintPk, publicKey);
      const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasuryPk);

      const instructions = [
        createMemoInstruction(memo, [publicKey]),
        createAssociatedTokenAccountIdempotentInstructionWithDerivation(
          publicKey,
          publicKey,
          mintPk,
        ),
        createAssociatedTokenAccountIdempotentInstructionWithDerivation(
          publicKey,
          treasuryPk,
          mintPk,
        ),
        createTransferCheckedInstruction(
          userAta,
          mintPk,
          treasuryAta,
          publicKey,
          amount,
          decimals,
          [],
          TOKEN_PROGRAM_ID,
        ),
      ];

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      setLastSig(signature);
      onSent?.(signature);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      setErr(msg || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }, [
    connection,
    memo,
    mintUsdc,
    onSent,
    publicKey,
    sendTransaction,
    treasury,
    usdc,
    walletMatchesSession,
  ]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!connected ? (
        <p className="text-xs text-amber-600 dark:text-amber-400/90 max-w-[62ch]">
          Connect your wallet in the header, then use Pay with wallet. Your connected address must
          match the signed-in session ({sessionWallet.slice(0, 4)}…
          {sessionWallet.slice(-4)}).
        </p>
      ) : null}

      {connected && !walletMatchesSession ? (
        <p className="text-xs text-amber-600 dark:text-amber-400/90 max-w-[62ch]">
          Connected wallet does not match your session. Disconnect and connect{" "}
          <span className="font-mono text-foreground">{sessionWallet.slice(0, 4)}…</span> or sign
          in again from that wallet.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !walletMatchesSession}
          onClick={() => void sendDeposit()}
          className={cn(
            "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirm in wallet…
            </>
          ) : (
            `Pay ${usdc} USDC with wallet`
          )}
        </button>

        <a
          href={payHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Solana Pay link
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>

      <p className="text-[11px] text-muted-foreground max-w-[62ch] leading-relaxed">
        Sends a memo instruction plus an SPL Token transfer (creates treasury ATA if needed). Same
        attribution rules apply — keep this memo unchanged.
      </p>

      {lastSig ? (
        <p className="text-xs font-mono">
          <span className="text-muted-foreground">Confirmed </span>
          <a
            href={solscanTxUrl(lastSig)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            View on Solscan
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      ) : null}

      {err ? (
        <p className="text-xs text-destructive max-w-[62ch] leading-relaxed">{err}</p>
      ) : null}
    </div>
  );
}
