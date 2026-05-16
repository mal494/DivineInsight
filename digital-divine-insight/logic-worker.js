// --- Internal State ---
let systemEntropy = 0;
let tarotDeck = []; // Will be populated from deck-data.json

// --- Helper: Flatten hierarchical deck structure ---
function flattenDeck(deckData) {
    const flattened = [];
    
    // Add major arcana
    deckData.deck.arcana.major.forEach(card => {
        flattened.push({
            id: card.key,
            name: card.name,
            weight: 1.0,
            element: card.element,
            arcana: 'major',
            fullData: card
        });
    });
    
    // Add minor arcana (all suits)
    Object.values(deckData.deck.arcana.minor).forEach(suitCards => {
        suitCards.forEach(card => {
            flattened.push({
                id: card.key,
                name: card.name,
                weight: 1.0,
                element: card.element,
                suit: card.suit,
                arcana: 'minor',
                fullData: card
            });
        });
    });
    
    return flattened;
}

// --- Systems-Oriented Logic Engine ---
function calculateDraw(seedData) {
    // Incorporate user input data (millisecond timing and velocity) into the calculation
    systemEntropy += seedData.velocityMetric;
    
    // Weight-based probability calculation
    const modifiedDeck = tarotDeck.map(card => {
        // Adjust weights based on system state/entropy to create cohesive pulls
        // This is where spread logic and card relationships are defined
        let adjustedWeight = card.weight;
        
        if (systemEntropy > 50 && card.element === 'Fire') {
            adjustedWeight *= 1.2; // Favor active/fiery cards if user movement was fast
        }
        
        return { ...card, currentWeight: adjustedWeight };
    });

    // Weighted random selection
    const totalWeight = modifiedDeck.reduce((sum, card) => sum + card.currentWeight, 0);
    let randomTarget = (Math.random() * totalWeight) + (seedData.timestamp % 1); // Mix standard random with user timestamp
    randomTarget = randomTarget % totalWeight;

    let selected = modifiedDeck[0];
    let weightSum = 0;
    
    for (const card of modifiedDeck) {
        weightSum += card.currentWeight;
        if (randomTarget <= weightSum) {
            selected = card;
            break;
        }
    }

    // Reset entropy slightly after a draw
    systemEntropy *= 0.5;

    return {
        cardId: selected.id,
        cardName: selected.name,
        systemState: systemEntropy,
        fullData: selected.fullData
    };
}

// --- Worker Communication ---
self.onmessage = function(e) {
    if (e.data.type === 'INIT_DECK') {
        // Initialize deck from main thread
        tarotDeck = flattenDeck(e.data.payload);
        console.log('[Worker] ✓ Deck initialized with', tarotDeck.length, 'cards');
        
    } else if (e.data.type === 'REQUEST_DRAW') {
        // Perform heavy calculation
        if (tarotDeck.length === 0) {
            console.error('[Worker] Deck not initialized');
            return;
        }
        
        const result = calculateDraw(e.data.payload);
        
        // Return to main thread
        self.postMessage({
            type: 'DRAW_RESULT',
            payload: result
        });
    }
};