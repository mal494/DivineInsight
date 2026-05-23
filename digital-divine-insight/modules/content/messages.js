export const STATUS_MESSAGES = Object.freeze({
    READY: 'Concentrate on your intent...',
    CHANNELING: 'Channeling intent...',
    LOGIC_PREPARING: 'Logic engine is still preparing...',
    AUDIO_PREPARING: 'Audio layer is still preparing...',
    INIT_FAILED: 'Initialization failed. Please refresh and try again.',
    STORAGE_UNAVAILABLE: 'Could not save reading history (storage unavailable).',
    DRAW_CONTRACT_MISMATCH: 'Draw result contract mismatch.',
    DRAW_FAILED: 'Could not draw a card.',
    JOURNAL_CLEARED: 'Arcana Journal cleared.'
});

export const JOURNAL_MESSAGES = Object.freeze({
    EMPTY: 'No saved readings yet.',
    UNKNOWN_DATE: 'Unknown date',
    UNKNOWN_CARD: 'Unknown Card',
    UNKNOWN_AXIS: 'balance'
});
