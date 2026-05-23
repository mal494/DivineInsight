/**
 * SettingsView - Manages the Altar Settings panel.
 * Allows users to adjust master volume and visual intensity.
 */
export class SettingsView {
    constructor(callbacks = {}) {
        this.panel = document.getElementById('settings-panel');
        this.closeBtn = document.getElementById('btn-close-settings');
        this.volumeSlider = document.getElementById('volume-slider');
        this.intensitySlider = document.getElementById('intensity-slider');
        
        this.onVolumeChange = callbacks.onVolumeChange;
        this.onIntensityChange = callbacks.onIntensityChange;

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.onVolumeChange?.(val);
            });
        }

        if (this.intensitySlider) {
            this.intensitySlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.onIntensityChange?.(val);
            });
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

    show() {
        if (!this.panel) return;
        this.panel.classList.remove('translate-x-full');
        this.panel.classList.add('translate-x-0');
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.add('translate-x-full');
        this.panel.classList.remove('translate-x-0');
    }
}
