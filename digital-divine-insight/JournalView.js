/**
 * JournalView - Manages the display and interaction of the Arcana Journal.
 * Displays a list of past readings provided by the app layer.
 */
export class JournalView {
    constructor() {
        this.panel = document.getElementById('journal-panel');
        this.listContainer = document.getElementById('journal-list');
        this.closeBtn = document.getElementById('btn-close-journal');
        
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
        return this.panel
            && !this.panel.classList.contains('hidden')
            && !this.panel.classList.contains('translate-x-full');
    }

    show(readings = [], renderedHtml = null) {
        if (!this.panel || !this.listContainer) return;

        if (renderedHtml) {
            this.listContainer.innerHTML = renderedHtml.join('');
        } else {
            this.renderList(readings);
        }
        
        // Show panel
        this.panel.classList.remove('hidden');
        this.panel.classList.remove('translate-x-full');
        this.panel.classList.add('translate-x-0');
        this.panel.setAttribute('aria-hidden', 'false');
        
        // Optional: Trigger ambient sound or particle effect if passed from app
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
        this.panel.classList.add('translate-x-full');
        this.panel.classList.remove('translate-x-0');
        this.panel.setAttribute('aria-hidden', 'true');
    }

    renderList(readings) {
        if (readings.length === 0) {
            this.listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-moon-silver/40 italic">
                    <span class="material-symbols-outlined text-4xl mb-4">history_edu</span>
                    <p>The pages are yet to be written...</p>
                    <p class="text-xs mt-2">Perform your first draw to begin your journal.</p>
                </div>
            `;
            return;
        }

        this.listContainer.innerHTML = readings.map(reading => this._renderEntry(reading)).join('');
    }

    _renderEntry(reading) {
        const date = new Date(reading.date);
        const dateStr = date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const timeStr = date.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const axisColors = {
            intellect: 'text-blue-400 border-blue-400/30',
            emotion: 'text-pink-400 border-pink-400/30',
            material: 'text-amber-400 border-amber-400/30',
            volition: 'text-red-400 border-red-400/30',
            balance: 'text-ethereal-teal border-ethereal-teal/30'
        };

        const colorClass = axisColors[reading.dominantAxis] || axisColors.balance;

        return `
            <div class="group relative bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-ethereal-teal/30 transition-all duration-300 mb-4 cursor-pointer">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h5 class="font-headline-md text-moon-silver group-hover:text-ethereal-teal transition-colors">
                            ${reading.cardName}
                            <span class="text-xs font-label-sm uppercase ml-2 opacity-60">
                                ${reading.orientation === 'reversed' ? '(Reversed)' : '(Upright)'}
                            </span>
                        </h5>
                        <p class="text-[10px] font-label-sm uppercase tracking-widest text-moon-silver/40 mt-1">
                            ${dateStr} • ${timeStr}
                        </p>
                    </div>
                    <div class="px-3 py-1 border rounded-full text-[10px] font-label-sm uppercase ${colorClass}">
                        ${reading.dominantAxis}
                    </div>
                </div>
                
                <div class="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-ethereal-teal">arrow_forward</span>
                </div>
            </div>
        `;
    }
}
