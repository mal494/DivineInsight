// --- Internal State ---
let tarotDeck = []; // Normalized deck cache built once from deck-data.json
let deckStats = {
    totalCards: 0,
    majorCount: 0,
    minorCount: 0,
    elementCounts: {},
    suitCounts: {}
};

const ZERO_VECTOR = Object.freeze({ x: 0, y: 0 });

const ELEMENT_VECTORS = Object.freeze({
    Air: { x: -1, y: 0 },
    Water: { x: 0, y: -1 },
    Earth: { x: 1, y: 0 },
    Fire: { x: 0, y: 1 }
});

const SUIT_VECTORS = Object.freeze({
    Cups: { x: 0, y: -1 },
    Pentacles: { x: 1, y: 0 },
    Swords: { x: -1, y: 0 },
    Wands: { x: 0, y: 1 },
    None: ZERO_VECTOR
});

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hashString(input) {
    let hash = 2166136261;

    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function hashToUnit(hash) {
    return hash / 4294967295;
}

function normalizeVector(vector = ZERO_VECTOR) {
    const magnitude = Math.hypot(vector.x, vector.y);

    if (!magnitude) {
        return ZERO_VECTOR;
    }

    return {
        x: vector.x / magnitude,
        y: vector.y / magnitude
    };
}

function buildCardVector(card) {
    const elementVector = ELEMENT_VECTORS[card.element] || ZERO_VECTOR;
    const suitVector = SUIT_VECTORS[card.suit] || ZERO_VECTOR;
    const arcanaVector = card.arcana === 'major' ? { x: 0, y: 0.25 } : { x: 0, y: -0.12 };

    return normalizeVector({
        x: elementVector.x + suitVector.x + arcanaVector.x,
        y: elementVector.y + suitVector.y + arcanaVector.y
    });
}

function normalizeDeck(deckData) {
    const arcana = deckData?.deck?.arcana || {};
    const majorCards = Array.isArray(arcana.major) ? arcana.major : [];
    const minorSuitGroups = arcana.minor && typeof arcana.minor === 'object' ? Object.values(arcana.minor) : [];
    const normalized = [];

    majorCards.forEach((card, index) => {
        normalized.push({
            id: card.key || card.id || `major-${index}`,
            name: card.name,
            weight: 1.15,
            element: card.element || 'None',
            suit: card.suit || 'None',
            arcana: 'major',
            vectorBasis: buildCardVector({ ...card, arcana: 'major' }),
            fullData: card
        });
    });

    minorSuitGroups.forEach(suitCards => {
        if (!Array.isArray(suitCards)) {
            return;
        }

        suitCards.forEach(card => {
            normalized.push({
                id: card.key || card.id || `${card.suit || 'minor'}-${normalized.length}`,
                name: card.name,
                weight: 1.0,
                element: card.element || 'None',
                suit: card.suit || 'None',
                arcana: 'minor',
                vectorBasis: buildCardVector({ ...card, arcana: 'minor' }),
                fullData: card
            });
        });
    });

    return normalized;
}

function summarizeDeck(deck) {
    return deck.reduce((summary, card) => {
        summary.totalCards += 1;
        summary[card.arcana === 'major' ? 'majorCount' : 'minorCount'] += 1;
        summary.elementCounts[card.element] = (summary.elementCounts[card.element] || 0) + 1;
        summary.suitCounts[card.suit] = (summary.suitCounts[card.suit] || 0) + 1;
        return summary;
    }, {
        totalCards: 0,
        majorCount: 0,
        minorCount: 0,
        elementCounts: {},
        suitCounts: {}
    });
}

function initializeDeck(deckSource) {
    const parsedDeck = typeof deckSource === 'string' ? JSON.parse(deckSource) : deckSource;

    tarotDeck = normalizeDeck(parsedDeck);
    deckStats = summarizeDeck(tarotDeck);

    return tarotDeck.length;
}

function createSessionState(seedData = {}) {
    const timestamp = Number(seedData.timestamp) || 0;
    const velocityMetric = Number(seedData.velocityMetric) || 0;
    const seedSignature = `${Math.round(timestamp * 1000)}|${Math.round(velocityMetric * 1000)}|${deckStats.totalCards}`;

    const seedHashA = hashString(`${seedSignature}|a`);
    const seedHashB = hashString(`${seedSignature}|b`);
    const seedHashC = hashString(`${seedSignature}|c`);

    const angle = hashToUnit(seedHashA) * Math.PI * 2;
    const velocityMagnitude = clamp(Math.abs(velocityMetric) / 18, 0, 1);
    const magnitude = clamp(0.35 + velocityMagnitude * 0.5 + hashToUnit(seedHashB) * 0.15, 0.25, 1);
    const polarity = velocityMetric >= 0 ? 1 : -1;

    const vector = {
        x: Math.cos(angle) * magnitude * polarity,
        y: Math.sin(angle) * magnitude
    };

    const drift = {
        x: (hashToUnit(seedHashB) - 0.5) * 2 * magnitude * 0.6,
        y: (hashToUnit(seedHashC) - 0.5) * 2 * magnitude * 0.6
    };

    const dominantAxis = Math.abs(vector.x) >= Math.abs(vector.y) ? 'horizontal' : 'vertical';
    const dominantElement = dominantAxis === 'horizontal'
        ? (vector.x >= 0 ? 'Earth' : 'Air')
        : (vector.y >= 0 ? 'Fire' : 'Water');
    const dominantSuit = dominantAxis === 'horizontal'
        ? (vector.x >= 0 ? 'Pentacles' : 'Swords')
        : (vector.y >= 0 ? 'Wands' : 'Cups');

    return {
        seedSignature,
        timestamp,
        velocityMetric,
        polarity,
        vector,
        drift,
        magnitude,
        entropy: clamp(Math.abs(velocityMetric) * 0.15 + hashToUnit(seedHashC) * 10, 0, 100),
        spreadRadius: clamp(0.35 + magnitude * 0.9, 0.35, 1.25),
        dominantElement,
        dominantSuit,
        sessionNoise: hashToUnit(hashString(`${seedSignature}|noise`))
    };
}

function scoreCard(card, session) {
    const alignment = ((card.vectorBasis.x * session.vector.x) + (card.vectorBasis.y * session.vector.y) + 1) / 2;
    const resonance = hashToUnit(hashString(`${session.seedSignature}|${card.id}|${card.arcana}|${card.element}|${card.suit}`));

    let adjustedWeight = card.weight * (0.78 + alignment * 0.52 + resonance * 0.28);

    if (card.arcana === 'major') {
        adjustedWeight *= 1.08;
    }

    if (session.dominantElement && card.element === session.dominantElement) {
        adjustedWeight *= 1.12;
    }

    if (session.dominantSuit && card.suit === session.dominantSuit) {
        adjustedWeight *= 1.06;
    }

    const selectionScore = adjustedWeight * (0.6 + resonance);

    return {
        ...card,
        alignment,
        resonance,
        adjustedWeight,
        selectionScore
    };
}

function synthesizePositionVector(card, session) {
    const x = session.vector.x + card.vectorBasis.x * 0.75 + session.drift.x * 0.25;
    const y = session.vector.y + card.vectorBasis.y * 0.75 + session.drift.y * 0.25;
    const magnitude = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    const spreadIndex = ((Math.round(((angle + Math.PI) / (Math.PI * 2)) * 12) % 12) + 12) % 12;

    return {
        x: Number((x * 100).toFixed(3)),
        y: Number((y * 100).toFixed(3)),
        angle: Number(angle.toFixed(6)),
        magnitude: Number(magnitude.toFixed(6)),
        spreadIndex,
        spreadRadius: Number(session.spreadRadius.toFixed(6))
    };
}

function calculateDraw(seedData) {
    const session = createSessionState(seedData);

    const scoredDeck = tarotDeck.map(card => scoreCard(card, session));
    const selected = scoredDeck.reduce((best, card) => {
        if (!best || card.selectionScore > best.selectionScore) {
            return card;
        }

        return best;
    }, null);

    const selectedPosition = synthesizePositionVector(selected, session);

    return {
        cardId: selected.id,
        cardName: selected.name,
        systemState: Number(session.entropy.toFixed(4)),
        fullData: selected.fullData,
        vectorState: {
            seedSignature: session.seedSignature,
            vector: {
                x: Number(session.vector.x.toFixed(6)),
                y: Number(session.vector.y.toFixed(6))
            },
            drift: {
                x: Number(session.drift.x.toFixed(6)),
                y: Number(session.drift.y.toFixed(6))
            },
            magnitude: Number(session.magnitude.toFixed(6)),
            entropy: Number(session.entropy.toFixed(4)),
            dominantElement: session.dominantElement,
            dominantSuit: session.dominantSuit,
            spreadRadius: Number(session.spreadRadius.toFixed(6))
        },
        positionVector: selectedPosition,
        cardBasis: {
            x: Number(selected.vectorBasis.x.toFixed(6)),
            y: Number(selected.vectorBasis.y.toFixed(6))
        }
    };
}

// --- Worker Communication ---
self.onmessage = function(e) {
    if (e.data.type === 'INIT_DECK') {
        try {
            const totalCards = initializeDeck(e.data.payload);
            console.log('[Worker] ✓ Deck initialized with', totalCards, 'cards');
        } catch (error) {
            console.error('[Worker] Failed to initialize deck:', error);
        }
    } else if (e.data.type === 'REQUEST_DRAW') {
        if (tarotDeck.length === 0) {
            console.error('[Worker] Deck not initialized');
            return;
        }

        const result = calculateDraw(e.data.payload);

        self.postMessage({
            type: 'DRAW_RESULT',
            payload: result
        });
    }
};