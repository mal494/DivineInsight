import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocalWeights, getDominantAxis } from '../../digital-divine-insight/modules/core/readingUtils.js';

test('buildLocalWeights boosts the mapped axis when element is present', () => {
    const weights = buildLocalWeights({ element: 'Water' });
    assert.ok(Math.abs(weights.emotion - 0.8) < 1e-9);
    assert.equal(weights.intellect, 0.1);
});

test('buildLocalWeights supports elemental_weight fallback for legacy payloads', () => {
    const weights = buildLocalWeights({ elemental_weight: 'Fire' });
    assert.ok(Math.abs(weights.volition - 0.8) < 1e-9);
});

test('getDominantAxis returns balance fallback for invalid payloads', () => {
    assert.equal(getDominantAxis(null), 'balance');
});

test('getDominantAxis uses deterministic axis order for ties', () => {
    const weights = { intellect: 0.5, emotion: 0.5, material: 0.2, volition: 0.1 };
    assert.equal(getDominantAxis(weights), 'intellect');
});
