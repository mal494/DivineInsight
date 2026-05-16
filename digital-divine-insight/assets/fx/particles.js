// assets/fx/particles.js

const canvas = document.getElementById('interaction-layer');
const ctx = canvas.getContext('2d');

// --- Canvas Sizing ---
// Ensure the canvas always fills the window to catch interactions anywhere
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Particle Configuration ---
const particles = [];
// Matching the video's aesthetic: Cyan from the logo, deep blue, and fiery orange/gold sparks
const magicColors = ['#00ffcc', '#00b3ff', '#ff8c00', '#ffd700'];

class Particle {
    constructor(x, y, inputVelocity) {
        this.x = x;
        this.y = y;
        
        // Scatter physics: Higher user velocity = more explosive scatter
        const angle = Math.random() * Math.PI * 2;
        // Map the user's velocity to the particle's speed, adding a baseline
        const speed = Math.random() * (inputVelocity * 0.4 + 1); 
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Visual properties
        this.life = 1.0; // Starts at 100% opacity
        this.decay = Math.random() * 0.03 + 0.01; // How fast it fades
        this.size = Math.random() * 5 + 2; // Radius between 2 and 7
        this.color = magicColors[Math.floor(Math.random() * magicColors.length)];
    }

    update() {
        // Move particle
        this.x += this.vx;
        this.y += this.vy;
        
        // Add slight "drag" or friction so they slow down naturally
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        // Add a slight upward drift to simulate smoke/magic energy
        this.vy -= 0.05; 

        // Fade and shrink
        this.life -= this.decay;
        this.size *= 0.96; 
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        // Fade out based on remaining life
        ctx.globalAlpha = Math.max(0, this.life); 
        ctx.fill();
    }
}

// --- Global API for app.js ---
// Exposing this function so app.js can trigger it during the pointermove loop
window.spawnParticles = function(x, y, velocity = 5) {
    // Dynamic generation: Faster mouse movement spawns more particles, 
    // but we cap it at 15 per frame to protect the sub-16ms performance budget.
    const amountToSpawn = Math.min(Math.floor(velocity / 2), 15);
    
    for (let i = 0; i < amountToSpawn; i++) {
        // Add a little randomness to the origin x/y so they don't spawn in a perfect line
        const offsetX = x + (Math.random() * 10 - 5);
        const offsetY = y + (Math.random() * 10 - 5);
        particles.push(new Particle(offsetX, offsetY, velocity));
    }
}

// --- Render Loop ---
function animateMagic() {
    // Clear the previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // THIS is the secret sauce for the "magical" look. 
    // It makes overlapping colors brighten, simulating glowing light.
    ctx.globalCompositeOperation = 'screen'; 

    // Loop backwards when removing items from an array to avoid index shifting bugs
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);

        // Garbage collection: remove dead particles
        if (p.life <= 0 || p.size <= 0.1) {
            particles.splice(i, 1);
        }
    }
    
    // Reset alpha for the next loop
    ctx.globalAlpha = 1.0; 
    requestAnimationFrame(animateMagic);
}

// Kick off the animation loop
animateMagic();