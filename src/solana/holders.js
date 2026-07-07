'use strict';
const { PublicKey } = require('@solana/web3.js');
const config = require('../config');
const { connection, wallet } = require('./connection');
const { getMintInfo } = require('./tokens');

// Pure: collapse token accounts to per-owner balances, drop excluded + below min.
function filterEligible(accounts, minHoldRaw, excludeSet) {
  const min = BigInt(minHoldRaw.toString());
  const byOwner = new Map();
  for (const a of accounts) {
    if (excludeSet.has(a.owner)) continue;
    byOwner.set(a.owner, (byOwner.get(a.owner) || 0n) + BigInt(a.amountRaw.toString()));
  }
  const out = [];
  for (const [owner, bal] of byOwner) {
    if (bal >= min) out.push({ owner, balanceRaw: bal.toString() });
  }
  return out;
}

// On-chain: all token accounts for `mint`, parsed + filtered. The SPL/Token-2022
// account layout shares the first 72 bytes: mint[0..32], owner[32..64], amount u64 LE[64..72].
async function snapshotEligibleHolders({ mint, minHoldRaw, exclude }) {
  if (config.dryRun) {
    // Two simulated eligible holders + the wallet (excluded) so cycles exercise the path.
    const sim = [
      { owner: 'SimHolder111111111111111111111111111111111', amountRaw: String(BigInt(minHoldRaw) * 2n) },
      { owner: 'SimHolder222222222222222222222222222222222', amountRaw: String(BigInt(minHoldRaw) * 3n) },
      { owner: wallet.publicKey.toBase58(), amountRaw: String(BigInt(minHoldRaw) * 9n) },
    ];
    return filterEligible(sim, minHoldRaw, exclude);
  }
  const { programId } = await getMintInfo(connection, mint);
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ memcmp: { offset: 0, bytes: new PublicKey(mint).toBase58() } }],
  });
  const parsed = accounts.map(({ account }) => {
    const data = account.data; // Buffer
    return {
      owner: new PublicKey(data.subarray(32, 64)).toBase58(),
      amountRaw: data.readBigUInt64LE(64).toString(),
    };
  });
  return filterEligible(parsed, minHoldRaw, exclude);
}

module.exports = { filterEligible, snapshotEligibleHolders };
