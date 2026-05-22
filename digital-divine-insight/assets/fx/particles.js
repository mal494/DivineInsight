/**
 * Particle System (Deep Obsidian Void with Drifting Stardust)
 * Handles background starfield and interactive ripple/burst effects.
 */

let canvas;
let ctx;
let particles = [];
let themeColor = '#00ffcc';
let themeRgb = '0, 255, 204';

/**
 * Updates the global particle theme color.
 * @param {string} axis - One of 'intellect', 'emotion', 'material', 'volition'.
 */
export function updateParticleTheme(axis) {
    const colors = {
        intellect: { hex: '#00ccff', rgb: '0, 204, 255' }, // Cyan/Air
        emotion: { hex: '#ff00cc', rgb: '255, 0, 204' },   // Magenta/Water
        material: { hex: '#ffcc00', rgb: '255, 204, 0' },  // Gold/Earth
        volition: { hex: '#ff3300', rgb: '255, 51, 0' },   // Red/Fire
        balance: { hex: '#00ffcc', rgb: '0, 255, 204' }    // Teal/Default
    };

    const theme = colors[axis] || colors.balance;
    themeColor = theme.hex;
    themeRgb = theme.rgb;
    
    // Convert 20% of existing stars to the new theme color immediately
    particles.forEach(p => {
        if (Math.random() > 0.8) p.color = themeColor;
    });
}

/**
 * Initializes the canvas and starts the animation loop.
 * @param {string} canvasId - The ID of the canvas element to use.
 */
export function initParticleSystem(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Particle system could not find canvas with ID: ${canvasId}`);
        return;
    }
    ctx = canvas.getContext('2d');
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Seed initial starfield
    for (let i = 0; i < 250; i++) {
        particles.push(new Particle());
    }
    
    animate();
}

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5;
        this.speedX = (Math.random() - 0.5) * 0.05;
        this.speedY = (Math.random() - 0.5) * 0.05;
        this.opacity = Math.random() * 0.6;
        this.pulse = Math.random() * 0.02;
        this.pulseDir = Math.random() > 0.5 ? 1 : -1;
        this.color = Math.random() > 0.8 ? themeColor : '#ffffff';
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity += this.pulse * this.pulseDir;
        
        if (this.opacity > 0.8 || this.opacity < 0.1) {
            this.pulseDir *= -1;
        }

        if (this.x < 0 || this.x > canvas.width) this.reset();
        if (this.y < 0 || this.y > canvas.height) this.reset();
    }

    draw() {
        ctx.shadowBlur = this.color !== '#ffffff' ? 8 : 2;
        ctx.shadowColor = this.color;
        
        let fillColor = `rgba(255, 255, 255, ${this.opacity})`;
        if (this.color !== '#ffffff') {
            fillColor = `rgba(${themeRgb}, ${this.opacity})`;
        }
        
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Creates a localized burst of particles at the specified coordinates.
 */
export function createBurst(x, y) {
    if (!canvas || !ctx) return;
    for (let i = 0; i < 30; i++) {
        const p = new Particle();
        p.x = x;
        p.y = y;
        p.speedX = (Math.random() - 0.5) * 5;
        p.speedY = (Math.random() - 0.5) * 5;
        p.size = Math.random() * 3;
        p.opacity = 1;
        p.color = themeColor;
        particles.push(p);
    }
}

function animate() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, index) => {
        p.update();
        p.draw();
        
        // Remove high velocity burst particles eventually as they fade
        if (Math.abs(p.speedX) > 1 && p.opacity < 0.2) {
            particles.splice(index, 1);
        }
    });
    requestAnimationFrame(animate);
}
