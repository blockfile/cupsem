'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

test('runCycle (DRY_RUN): claim, buy $CUPSY + $ANSEM, airdrop both, no burn', async () => {
  process.env.DRY_RUN = 'true';
  process.env.SIMULATE_GRADUATED = 'true';
  process.env.TOKEN_MINT = 'Ai69001111111111111111111111111111111111111'; // holder token
  process.env.CUPSY_MINT = '6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump'; // $CUPSY
  process.env.ANSEM_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'; // $ANSEM
  process.env.CUPSY_BUY_PCT = '40';
  process.env.ANSEM_BUY_PCT = '40';
  delete require.cache[require.resolve('../config')];
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'cupsem_test_cycle';
  const db = require('../db/index');
  const repo = require('../db/repository');
  const simvault = require('../solana/simvault');
  const { runCycle } = require('./cycle');
  await db.connect();
  try {
    simvault.reset(1.5); // creator-fee vault has fees to claim
    const cycle = await runCycle();
    assert.strictEqual(cycle.status, 'complete');
    assert.ok(typeof cycle.eligible_holders === 'number', 'records the eligible-holder count');
    const names = cycle.steps.map((s) => s.name);
    assert.ok(names.includes('claim'));
    assert.strictEqual(names.filter((n) => n === 'buy').length, 2, 'two buys ($CUPSY + $ANSEM)');
    assert.strictEqual(names.filter((n) => n === 'airdrop').length, 2, 'two airdrops ($CUPSY + $ANSEM)');
    assert.strictEqual(names.filter((n) => n === 'burn').length, 0, 'no burns');

    // Each buy spends its own 40% of the 1.5 SOL claim.
    const buys = cycle.steps.filter((s) => s.name === 'buy');
    for (const b of buys) {
      assert.strictEqual(b.detail.solSpent, 0.6, `buy of ${b.detail.buyMint} spends 40% of the claim`);
    }
    const buyMints = new Set(buys.map((b) => b.detail.buyMint));
    assert.ok(buyMints.has(process.env.CUPSY_MINT), 'bought $CUPSY');
    assert.ok(buyMints.has(process.env.ANSEM_MINT), 'bought $ANSEM');

    const { items } = await repo.getAirdrops(500, 0);
    const mints = new Set(items.map((a) => a.reward_mint));
    assert.ok(mints.has(process.env.CUPSY_MINT), 'airdropped $CUPSY');
    assert.ok(mints.has(process.env.ANSEM_MINT), 'airdropped $ANSEM');
    assert.ok(!mints.has(process.env.TOKEN_MINT), 'holder token was NOT airdropped');
  } finally {
    await db.close();
    await mongod.stop();
    delete require.cache[require.resolve('../config')];
  }
});
