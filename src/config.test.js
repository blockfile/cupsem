'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('config exposes dual-reward loop defaults (40% $CUPSY / 40% $ANSEM)', () => {
  const config = require('./config');
  assert.strictEqual(config.cupsyBuyPct, 40);
  assert.strictEqual(config.ansemBuyPct, 40);
  assert.strictEqual(config.ansemMint, '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump');
  assert.strictEqual(config.rewardCapPct, 0);
  assert.strictEqual(config.minHold, 100000);
  assert.strictEqual(config.pollSchedule, '*/5 * * * *');
  assert.strictEqual(config.dryRunFeePerPoll, 0.4);
  assert.strictEqual(config.airdropBatchSize, 8);
  assert.ok(Array.isArray(config.clusters));
  assert.ok(Array.isArray(config.airdropExclude));
});

test('config.clusters parses a JSON array-of-arrays from env', () => {
  delete require.cache[require.resolve('./config')];
  process.env.CLUSTERS = '[["AAA","BBB"],["CCC"]]';
  const config = require('./config');
  assert.deepStrictEqual(config.clusters, [['AAA', 'BBB'], ['CCC']]);
  delete process.env.CLUSTERS;
  delete require.cache[require.resolve('./config')];
});

test('config throws when the two buy percents leave no reserve (> 100%)', () => {
  delete require.cache[require.resolve('./config')];
  process.env.CUPSY_BUY_PCT = '60';
  process.env.ANSEM_BUY_PCT = '60';
  assert.throws(() => require('./config'), /exceeds 100%/);
  delete process.env.CUPSY_BUY_PCT;
  delete process.env.ANSEM_BUY_PCT;
  delete require.cache[require.resolve('./config')];
});
