# BABYCUPSY / $CUPSY rebrand — design

**Date:** 2026-07-08
**Status:** Approved

## Goal

Reuse the existing claim → buy → airdrop engine for a new token pair:

- **Holder token:** BABYCUPSY ("baby cupsy") — to be deployed on pump.fun; its
  creator fees fund every cycle. `TOKEN_MINT` stays blank in `.env` until deploy.
- **Reward token:** $CUPSY — `6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump`.

## Cycle (unchanged mechanics, new parameters)

Every **5 minutes** (`POLL_SCHEDULE=*/5 * * * *`, was every 3):

1. Claim whatever pump.fun creator fees have accrued to BABYCUPSY (skip silently
   when the vault is empty).
2. Buy $CUPSY with **80%** of the claimed SOL; 20% stays in the operating wallet
   for tx fees + per-recipient ATA rent.
3. Airdrop the bought $CUPSY to BABYCUPSY holders, **pro-rata by holdings**,
   no per-wallet cap, minimum hold **100,000** BABYCUPSY.

## Changes

Same shape as the previous rebrand of this engine, applied to a fresh repo
(github.com/blockfile/cupsy):

- Env/config: the reward-mint vars become `CUPSY_MINT`/`CUPSY_BUY_PCT`
  (config keys `cupsyMint`/`cupsyBuyPct`); `TOKEN_SYMBOL=BABYCUPSY`;
  Mongo default db → `babycupsy`; poll default → `*/5 * * * *`.
- Rename the old-brand references across `server.js`, `src/`, tests,
  `package.json`, `.env.example`, `docs/DEPLOY.md`. API fields follow
  (`cupsyDistributed`, `/airdrops?token=CUPSY|BABYCUPSY`).
- Historical specs/plans from earlier incarnations are not carried over.

No structural changes: DRY_RUN mode, batching, clusters/excludes, routes, and
the scheduler all stay as they are.
