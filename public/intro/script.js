document.addEventListener('DOMContentLoaded', () => {
    
    // --- CANVAS FX ENGINE --- //
    const canvas = document.getElementById('fx-canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    
    let width, height;
    function resizeCanvas() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // -- Particles (Spores/Ash) -- //
    const particles = [];
    const PARTICLE_COUNT = Math.floor(window.innerWidth / 15);

    class Particle {
        constructor() {
            this.reset();
            // Spread initial Y fully across the screen instead of entering from bottom
            this.y = Math.random() * height;
        }

        reset() {
            this.x = Math.random() * width;
            this.y = height + Math.random() * 200;
            this.z = Math.random() * 2 + 0.5; // Depth factor (closest = larger, faster)
            this.size = (Math.random() * 2.5 + 0.5) * this.z;
            this.speedY = -(Math.random() * 0.8 + 0.2) * this.z;
            this.speedX = (Math.random() - 0.5) * 0.5 * this.z;
            this.opacity = Math.random() * 0.6 + 0.1;
            this.wobble = Math.random() * Math.PI * 2;
            this.wobbleSpeed = Math.random() * 0.02;
        }

        update() {
            this.y += this.speedY;
            this.wobble += this.wobbleSpeed;
            this.x += this.speedX + Math.sin(this.wobble) * 0.5;

            // Reset if it drifts off top
            if (this.y < -50 || this.x < -50 || this.x > width + 50) {
                this.reset();
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            // Reddish spores reflecting the environment
            ctx.fillStyle = `rgba(255, ${Math.random() * 50}, 50, ${this.opacity})`;
            ctx.fill();
            
            // Subtle glow for closer spores
            if (this.z > 2) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 0, 51, 0.5)';
            } else {
                ctx.shadowBlur = 0;
            }
        }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }

    // -- Lightning / Thunder System -- //
    let lightnings = [];
    let nextLightningTime = 0;

    class Lightning {
        constructor() {
            this.segments = [];
            // Random start point across the top
            this.x = Math.random() * width;
            this.y = 0;
            this.generatePath(this.x, this.y, (Math.random() - 0.5) * 2, 5 + Math.random() * 3, 0);
            this.life = 0;
            this.maxLife = 15 + Math.random() * 15; // Frames
            
            // Screen flash effect
            document.body.classList.add('flash');
            setTimeout(() => document.body.classList.remove('flash'), 100 + Math.random() * 200);
        }

        generatePath(x, y, dx, dy, depth) {
            if (y > height || depth > 8 || x < 0 || x > width) return;

            const newX = x + dx * 15 + (Math.random() - 0.5) * 20;
            const newY = y + dy * 15;

            this.segments.push({ x1: x, y1: y, x2: newX, y2: newY });

            // Branching probability
            if (Math.random() < 0.2 && depth < 6) {
                this.generatePath(newX, newY, dx + (Math.random() - 0.5) * 2, dy, depth + 1);
            }
            
            this.generatePath(newX, newY, dx + (Math.random() - 0.5) * 0.5, dy, depth + 1);
        }

        draw() {
            this.life++;
            const alpha = 1 - (this.life / this.maxLife);
            
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Outer Red Glow
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 0, 51, ${alpha * 0.4})`;
            ctx.lineWidth = 15;
            ctx.shadowBlur = 30;
            ctx.shadowColor = `rgba(255, 0, 51, ${alpha})`;
            this.segments.forEach(seg => {
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
            });
            ctx.stroke();

            // Inner White/Hot Core
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 200, 200, ${alpha * 0.8})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            this.segments.forEach(seg => {
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
            });
            ctx.stroke();
            
            ctx.restore();
        }

        isDead() {
            return this.life >= this.maxLife;
        }
    }

    function renderLoop() {
        // Clear canvas with deep black/red transparency to create trail effects
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Slight trail
        ctx.fillRect(0, 0, width, height);

        // Draw and update particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Trigger spontaneous red lightning
        if (Date.now() > nextLightningTime) {
            lightnings.push(new Lightning());
            // Next strike in 3-10 seconds
            nextLightningTime = Date.now() + 3000 + Math.random() * 7000;
        }

        // Draw lightnings
        lightnings.forEach(L => L.draw());
        lightnings = lightnings.filter(L => !L.isDead());

        requestAnimationFrame(renderLoop);
    }

    // Start rendering
    nextLightningTime = Date.now() + 2000; // First strike in 2s
    renderLoop();

    // --- PARALLAX MOUSE EFFECT --- //
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    window.addEventListener('mousemove', (e) => {
        // Normalize mouse coordinates from -1 to 1
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = (e.clientY / window.innerHeight) * 2 - 1;
    });

    function lerpParallax() {
        // Smooth lerp for cinematic floating feel
        currentX += (targetX - currentX) * 0.03;
        currentY += (targetY - currentY) * 0.03;
        
        // Pass variables to CSS engine
        document.body.style.setProperty('--px', currentX.toFixed(4));
        document.body.style.setProperty('--py', currentY.toFixed(4));
        
        requestAnimationFrame(lerpParallax);
    }
    lerpParallax();

    // --- INTERACTIVITY / EXPERIENCE TRANSITION --- //
    const enterBtn = document.getElementById('enter-btn');
    enterBtn.addEventListener('click', () => {
        // Trigger glitch out sequence
        document.body.classList.add('transitioning');
        
        // Intensity the canvas lightning/particles
        nextLightningTime = Date.now();
        
        // Redirect after animation
        setTimeout(() => {
            window.location.href = '/broadcaster';
        }, 2000);
    });
});
