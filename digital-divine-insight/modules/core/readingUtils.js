/**
 * Reading utilities shared by UI rendering and worker synthesis.
 */

export const AXIS_ORDER = Object.freeze(['intellect', 'emotion', 'material', 'volition']);

const ELEMENT_TO_AXIS = Object.freeze({
    Air: 'intellect',
    Water: 'emotion',
    Earth: 'material',
    Fire: 'volition'
});

/**
 * Builds stable local axis weights from card elemental metadata.
 * @param {Object} card
 * @returns {{intellect:number, emotion:number, material:number, volition:number}}
 */
export function buildLocalWeights(card = {}) {
    const weights = {
        intellect: 0.1,
        emotion: 0.1,
        material: 0.1,
        volition: 0.1
    };

    const element = String(card.element || card.elemental_weight || '').trim();
    const axis = ELEMENT_TO_AXIS[element];

    if (axis) {
        weights[axis] += 0.7;
    }

    return weights;
}

/**
 * Chooses the dominant axis using deterministic tie-breaking.
 * @param {Object} weights
 * @param {string} [fallback='balance']
 * @returns {string}
 */
export function getDominantAxis(weights, fallback = 'balance') {
    if (!weights || typeof weights !== 'object') return fallback;

    let winner = fallback;
    let winnerScore = Number.NEGATIVE_INFINITY;

    AXIS_ORDER.forEach((axis, index) => {
        const raw = Number(weights[axis]);
        const score = Number.isFinite(raw) ? raw : Number.NEGATIVE_INFINITY;

        if (score > winnerScore) {
            winner = axis;
            winnerScore = score;
            return;
        }

        if (score === winnerScore && winner !== fallback) {
            const currentIndex = AXIS_ORDER.indexOf(winner);
            if (currentIndex === -1 || index < currentIndex) {
                winner = axis;
            }
        }
    });

    return winner;
}
