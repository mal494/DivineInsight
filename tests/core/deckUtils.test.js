import test from 'node:test';
import assert from 'node:assert/strict';

import { extractCards, extractCardImageKeys, parseDeckPayload } from '../../digital-divine-insight/modules/core/deckUtils.js';

test('extractCards supports flat cards schema', () => {
    const source = { cards: [{ key: 'major-01' }, { id: 'cups-02' }] };
    assert.equal(extractCards(source).length, 2);
});

test('extractCards supports arcana schema', () => {
    const source = {
        deck: {
            arcana: {
                major: [{ key: 'major-00' }],
                minor: {
                    cups: [{ key: 'cups-01' }],
                    swords: [{ key: 'swords-01' }]
                }
            }
        }
    };

    assert.equal(extractCards(source).length, 3);
});

test('extractCardImageKeys normalizes to strings and removes empties', () => {
    const source = {
        cards: [{ key: 'major-00' }, { id: 7 }, { key: '' }, {}]
    };

    assert.deepEqual(extractCardImageKeys(source), ['major-00', '7']);
});

test('parseDeckPayload handles json string payloads', () => {
    const payload = '{"cards":[{"key":"major-00"}]}';
    const parsed = parseDeckPayload(payload);

    assert.equal(parsed.cards[0].key, 'major-00');
});
