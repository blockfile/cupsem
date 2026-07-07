# cupsem — dual-reward backend ($CUPSY + $ANSEM) — design

**Date:** 2026-07-08
**Repo:** https://github.com/blockfile/cupsem.git (copied from blockfile/cupsy)

## What this is

A copy of the babycupsy reward backend for a NEW pump.fun token (mint filled into
`TOKEN_MINT` at launch). Its creator fees fund TWO reward streams instead of one:
each cycle buys **$CUPSY** and **$ANSEM** and airdrops both to holders pro-rata.

## Fee split (per claim)

```
claim 1.0 SOL
├─ 0.40 SOL → buy $CUPSY  → airdrop to holders pro-rata
├─ 0.40 SOL → buy $ANSEM  → airdrop to holders pro-rata
└─ 0.20 SOL → stays in operating wallet (tx fees + per-recipient ATA rent)
```

80% of the claim goes to buys, split 50/50. The 20% reserve is unchanged from
babycupsy.

## Approach (chosen: B — explicit second mint)

Mirror the existing `CUPSY_MINT`/`CUPSY_BUY_PCT` pattern with `ANSEM_MINT`/
`ANSEM_BUY_PCT`. Rejected: a generic JSON rewards list (refactor with no current
need) and a second reward leg (would snapshot holders twice per cycle for nothing —
`runRewardLeg` already loops a `buys[]` array against one snapshot).

## Changes

- **config.js** — add `ansemMint` (env `ANSEM_MINT`, default
  `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump`), `ansemBuyPct` (env
  `ANSEM_BUY_PCT`, default 40); `cupsyBuyPct` default drops 80 → 40. Throw at
  startup if `cupsyBuyPct + ansemBuyPct > 100`.
- **jobs/cycle.js** — require `ansemMint` alongside the others; `buys:` gains
  `{ mint: config.ansemMint, solAmount: sol(config.ansemBuyPct) }`. Buy routing
  (curve / AMM / Jupiter) already resolves per mint; airdrops already record
  `reward_mint` per send. Buys run sequentially; a failure mid-cycle marks the
  cycle `failed` with earlier steps preserved (unchanged semantics).
- **services/format.js** — `toPublicSummary` also reports `ansemDistributed`
  (total $ANSEM sent) keyed by the ANSEM mint, same as `cupsyDistributed`;
  `distributions` becomes the sum of both streams' sends.
- **routes/public.js** — `tokenToMint` map gains `ANSEM`; `/airdrops?token=ANSEM`
  filters that stream. `loadSummary` passes `ansemMint` through.
- **routes/status.js** — `token.ansemMint` and `config.ansemBuyPct` exposed.
- **Rebrand** — package name/description, server banner + log prefixes
  `babycupsy` → `cupsem`, `.env.example` reward section, `docs/DEPLOY.md`
  (repo URL, pm2 process name), Mongo default db `cupsem`.

## Out of scope

Frontend for the new site; server deployment (same DEPLOY.md recipe, new domain);
launching the pump.fun token itself.

## Testing

- `cycle.test.js`: a DRY_RUN cycle records TWO buy steps and TWO airdrop streams
  (one per reward mint), each funded with 40% of the claim.
- `config.test.js`: percent-sum validation throws when `CUPSY_BUY_PCT +
  ANSEM_BUY_PCT > 100`.
- Full `node --test` suite green before first commit.
