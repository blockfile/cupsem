'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { filterEligible } = require('./holders');

test('sums per owner, applies minimum and exclusions', () => {
  const accounts = [
    { owner: 'A', amountRaw: '60000' },
    { owner: 'A', amountRaw: '50000' }, // A totals 110000
    { owner: 'B', amountRaw: '90000' }, // below 100000
    { owner: 'POOL', amountRaw: '999999999' }, // excluded
  ];
  const out = filterEligible(accounts, 100000n, new Set(['POOL']));
  assert.deepStrictEqual(out, [{ owner: 'A', balanceRaw: '110000' }]);
});
