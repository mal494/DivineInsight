/**
 * Deck utility helpers shared by app orchestration and worker runtime.
 */

/**
 * Parse a deck payload that may be a JSON string or an already parsed object.
 * @param {string|Object} payload
 * @returns {Object}
 */
export function parseDeckPayload(payload) {
    if (typeof payload === 'string') {
        return JSON.parse(payload);
    }

    return (payload && typeof payload === 'object') ? payload : {};
}

/**
 * Extracts all cards from either the flat `cards` schema or arcana-grouped schema.
 * @param {Object} deckData
 * @returns {Array<Object>}
 */
export function extractCards(deckData) {
    if (Array.isArray(deckData?.cards)) {
        return deckData.cards;
    }

    const arcana = deckData?.deck?.arcana || {};
    const majorCards = Array.isArray(arcana.major) ? arcana.major : [];
    const minorGroups = arcana.minor && typeof arcana.minor === 'object'
        ? Object.values(arcana.minor)
        : [];

    return [
        ...majorCards,
        ...minorGroups.flatMap(group => (Array.isArray(group) ? group : []))
    ];
}

/**
 * Produces a clean list of image keys used for deck animation frames.
 * @param {Object} deckData
 * @returns {string[]}
 */
export function extractCardImageKeys(deckData) {
    return extractCards(deckData)
        .map(card => card?.key || card?.id)
        .filter(Boolean)
        .map(String);
}
