/**
 * GalleryView - Manages the display and interaction of the 78-card Deck Gallery.
 * Renders a grid of cards and allows users to view their basic meanings.
 */
export class GalleryView {
    constructor() {
        this.panel = document.getElementById('gallery-panel');
        this.gridContainer = document.getElementById('gallery-grid');
        this.closeBtn = document.getElementById('btn-close-gallery');
        this.deckData = null;
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }

        // Handle escape key to close
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });
    }

    isVisible() {
        return this.panel && !this.panel.classList.contains('translate-x-full');
    }

    show(deckData, renderedHtml = null) {
        if (!this.panel || !this.gridContainer) return;
        
        if (renderedHtml) {
            this.gridContainer.innerHTML = renderedHtml.join('');
        } else {
            this.deckData = deckData;
            this.renderGrid();
        }
        
        // Show panel
        this.panel.classList.remove('translate-x-full');
        this.panel.classList.add('translate-x-0');
        this.panel.setAttribute('aria-hidden', 'false');
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.add('translate-x-full');
        this.panel.classList.remove('translate-x-0');
        this.panel.setAttribute('aria-hidden', 'true');
    }

    renderGrid() {
        if (!this.deckData) return;

        // Extract all cards from the optimized JSON structure
        const cards = this.deckData.cards || [];
        
        if (cards.length === 0) {
            this.gridContainer.innerHTML = '<p class="text-moon-silver/40 italic text-center col-span-full">The deck is hidden in the shadows...</p>';
            return;
        }

        this.gridContainer.innerHTML = cards.map(card => this._renderCardItem(card)).join('');
    }

    _renderCardItem(card) {
        const key = card.key || card.id;
        const arcanaClass = card.arcana === 'Major' ? 'border-astral-gold/40 text-astral-gold' : 'border-moon-silver/20 text-moon-silver/60';
        const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgMzAwIDUwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA1MDUwOCIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjI1MCIgcj0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Q0YWYzNyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI1LDUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2Q0YWYzNyIgZm9udC1mYW1pbHk9IkNpbnplbCIgZm9udC1zaXplPSIxMiI+QUJDQU5BIFZPSUQ8L3RleHQ+PC9zdmc+';

        return `
            <div class="group relative aspect-[2/3] bg-midnight-obsidian rounded-lg overflow-hidden border border-white/5 hover:border-ethereal-teal/50 transition-all duration-500 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(0,255,204,0.2)]">
                <img 
                    src="assets/img/deck/${key}.jpg" 
                    alt="${card.name}" 
                    class="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-700"
                    loading="lazy"
                    onerror="this.src='${fallbackSvg}'; window.handleGalleryAssetError?.('${key}')"
                >
                <div class="absolute inset-0 bg-gradient-to-t from-midnight-obsidian via-midnight-obsidian/20 to-transparent"></div>
                
                <div class="absolute bottom-0 left-0 w-full p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    <p class="text-[10px] font-label-sm uppercase tracking-widest ${arcanaClass} mb-1">
                        ${card.arcana} ${card.suit !== 'None' ? '• ' + card.suit : ''}
                    </p>
                    <h6 class="font-headline-md text-sm text-moon-silver group-hover:text-ethereal-teal transition-colors leading-tight">
                        ${card.name}
                    </h6>
                </div>

                <!-- Hover Overlay with Keywords -->
                <div class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-midnight-obsidian/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-center">
                    <p class="text-xs font-body-md text-moon-silver italic mb-4">"${card.description || ''}"</p>
                    <div class="flex flex-wrap justify-center gap-1">
                        ${(card.meanings?.upright?.keywords || []).slice(0, 3).map(k => `
                            <span class="text-[8px] font-label-sm uppercase px-2 py-0.5 border border-ethereal-teal/30 text-ethereal-teal rounded-full">${k}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}
