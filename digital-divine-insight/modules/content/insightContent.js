export const AXIS_INTERPRETATIONS = Object.freeze({
    intellect: 'a surge of structural logic and mental clarity.',
    emotion: 'deep intuitive currents and emotional resonance.',
    material: 'a grounding force anchored in physical reality.',
    volition: 'high-velocity manifestation and fiery drive.'
});

export const ORIENTATION_CONTEXT = Object.freeze({
    upright: 'This energy is flowing freely, open to external manifestation.',
    reversed: 'However, its reversed position suggests this energy is currently internalized, blocked, or experiencing friction.'
});

export function buildInsightDescription({ cardName, dominantAxis, orientation }) {
    const axisText = AXIS_INTERPRETATIONS[dominantAxis] || 'a shifting dynamic.';
    const orientationText = ORIENTATION_CONTEXT[orientation] || ORIENTATION_CONTEXT.upright;
    return `The presence of ${cardName} at the threshold introduces ${axisText} ${orientationText}`;
}
