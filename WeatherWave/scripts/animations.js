/**
 * Animation Controller
 * Handles dynamic weather animations, particle effects, and visual enhancements
 */

class AnimationController {
    constructor() {
        this.particles = [];
        this.animationFrame = null;
        this.isAnimating = false;
        this.currentWeatherType = null;
        this.particleCount = 50;
        this.animationSpeed = 1;
        
        // Performance monitoring
        this.lastFrameTime = 0;
        this.frameRate = 60;
        this.performanceMode = 'high'; // high, medium, low
        
        this.init();
    }

    /**
     * Initialize animation controller
     */
    init() {
        this.detectPerformanceMode();
        this.bindEvents();
        this.setupCanvas();
    }

    /**
     * Detect device performance and adjust animation settings
     */
    detectPerformanceMode() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        // Check for hardware acceleration
        const hasWebGL = !!gl;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEndDevice = navigator.hardwareConcurrency < 4;
        
        if (!hasWebGL || isMobile || isLowEndDevice) {
            this.performanceMode = 'low';
            this.particleCount = 20;
            this.frameRate = 30;
        } else if (isMobile) {
            this.performanceMode = 'medium';
            this.particleCount = 35;
            this.frameRate = 45;
        }
        
        // Respect user's motion preferences
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.performanceMode = 'low';
            this.particleCount = 10;
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Visibility API to pause animations when tab is not active
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Reduced motion preference change
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            if (e.matches) {
                this.performanceMode = 'low';
                this.particleCount = 5;
                this.updateAnimationSettings();
            }
        });
    }

    /**
     * Set up canvas for particle animations
     */
    setupCanvas() {
        // Create canvas element for particle effects
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'weather-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        `;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    /**
     * Resize canvas to match container
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = document.querySelector('.weather-background');
        if (container) {
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.resizeCanvas();
        // Recreate particles for new canvas size
        if (this.currentWeatherType) {
            this.createParticles(this.currentWeatherType);
        }
    }

    /**
     * Update weather background based on condition
     */
    updateWeatherBackground(condition) {
        if (!condition) return;
        
        const weatherType = this.getWeatherType(condition);
        if (weatherType === this.currentWeatherType) return;
        
        this.currentWeatherType = weatherType;
        this.clearAnimations();
        this.setBackground(weatherType);
        this.createParticles(weatherType);
        this.startAnimation();
    }

    /**
     * Determine weather type from condition string
     */
    getWeatherType(condition) {
        const conditionLower = condition.toLowerCase();
        
        if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
            return 'stormy';
        }
        if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
            return 'rainy';
        }
        if (conditionLower.includes('snow') || conditionLower.includes('blizzard')) {
            return 'snowy';
        }
        if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
            return 'cloudy';
        }
        if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
            return 'misty';
        }
        if (conditionLower.includes('sun') || conditionLower.includes('clear')) {
            return 'sunny';
        }
        
        return 'clear';
    }

    /**
     * Set background class based on weather type
     */
    setBackground(weatherType) {
        const background = document.getElementById('weatherBackground');
        if (!background) return;
        
        // Remove existing weather classes
        background.className = 'weather-background';
        
        // Add new weather class
        background.classList.add(`${weatherType}-bg`);
        
        // Add canvas if needed
        if (this.needsParticles(weatherType) && !background.contains(this.canvas)) {
            background.appendChild(this.canvas);
        }
    }

    /**
     * Check if weather type needs particle effects
     */
    needsParticles(weatherType) {
        return ['rainy', 'snowy', 'stormy'].includes(weatherType);
    }

    /**
     * Create particles based on weather type
     */
    createParticles(weatherType) {
        this.particles = [];
        
        if (!this.needsParticles(weatherType) || !this.canvas) return;
        
        const particleCount = this.getParticleCount(weatherType);
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(this.createParticle(weatherType));
        }
    }

    /**
     * Get particle count based on weather type and performance
     */
    getParticleCount(weatherType) {
        const baseCount = {
            'rainy': this.particleCount * 1.5,
            'snowy': this.particleCount,
            'stormy': this.particleCount * 0.8
        };
        
        return Math.floor(baseCount[weatherType] || this.particleCount);
    }

    /**
     * Create individual particle
     */
    createParticle(weatherType) {
        const particle = {
            x: Math.random() * this.canvas.width,
            y: -10,
            opacity: Math.random() * 0.8 + 0.2,
            type: weatherType
        };
        
        switch (weatherType) {
            case 'rainy':
                particle.speed = Math.random() * 8 + 5;
                particle.length = Math.random() * 15 + 10;
                particle.width = Math.random() * 2 + 1;
                particle.angle = Math.random() * 10 - 5; // Slight angle
                break;
            
            case 'snowy':
                particle.speed = Math.random() * 3 + 1;
                particle.size = Math.random() * 4 + 2;
                particle.drift = Math.random() * 2 - 1;
                particle.rotation = Math.random() * 360;
                particle.rotationSpeed = Math.random() * 4 - 2;
                break;
            
            case 'stormy':
                particle.speed = Math.random() * 12 + 8;
                particle.length = Math.random() * 20 + 15;
                particle.width = Math.random() * 3 + 2;
                particle.angle = Math.random() * 20 - 10;
                particle.intensity = Math.random() * 0.5 + 0.5;
                break;
        }
        
        return particle;
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }

    /**
     * Animation loop
     */
    animate = () => {
        if (!this.isAnimating) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        // Throttle frame rate based on performance mode
        const targetFrameTime = 1000 / this.frameRate;
        
        if (deltaTime >= targetFrameTime) {
            this.updateParticles();
            this.drawParticles();
            this.lastFrameTime = currentTime;
        }
        
        this.animationFrame = requestAnimationFrame(this.animate);
    }

    /**
     * Update particle positions and properties
     */
    updateParticles() {
        if (!this.particles.length || !this.canvas) return;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update position based on type
            switch (particle.type) {
                case 'rainy':
                    particle.y += particle.speed;
                    particle.x += Math.sin(particle.angle * Math.PI / 180) * 0.5;
                    break;
                
                case 'snowy':
                    particle.y += particle.speed;
                    particle.x += particle.drift;
                    particle.rotation += particle.rotationSpeed;
                    break;
                
                case 'stormy':
                    particle.y += particle.speed;
                    particle.x += Math.sin(particle.angle * Math.PI / 180) * 2;
                    particle.opacity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
                    break;
            }
            
            // Remove particles that are off screen
            if (particle.y > this.canvas.height + 50 || 
                particle.x < -50 || 
                particle.x > this.canvas.width + 50) {
                this.particles.splice(i, 1);
                // Create new particle at the top
                this.particles.push(this.createParticle(particle.type));
            }
        }
    }

    /**
     * Draw particles on canvas
     */
    drawParticles() {
        if (!this.ctx || !this.particles.length) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (const particle of this.particles) {
            this.ctx.save();
            this.ctx.globalAlpha = particle.opacity;
            
            switch (particle.type) {
                case 'rainy':
                    this.drawRainDrop(particle);
                    break;
                
                case 'snowy':
                    this.drawSnowflake(particle);
                    break;
                
                case 'stormy':
                    this.drawStormDrop(particle);
                    break;
            }
            
            this.ctx.restore();
        }
    }

    /**
     * Draw rain drop
     */
    drawRainDrop(particle) {
        this.ctx.strokeStyle = `rgba(174, 194, 224, ${particle.opacity})`;
        this.ctx.lineWidth = particle.width;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(particle.x, particle.y);
        this.ctx.lineTo(particle.x, particle.y + particle.length);
        this.ctx.stroke();
    }

    /**
     * Draw snowflake
     */
    drawSnowflake(particle) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        this.ctx.translate(particle.x, particle.y);
        this.ctx.rotate(particle.rotation * Math.PI / 180);
        
        // Simple snowflake shape
        this.ctx.beginPath();
        this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add sparkle effect for larger snowflakes
        if (particle.size > 3) {
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${particle.opacity * 0.5})`;
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.moveTo(-particle.size, 0);
            this.ctx.lineTo(particle.size, 0);
            this.ctx.moveTo(0, -particle.size);
            this.ctx.lineTo(0, particle.size);
            this.ctx.stroke();
        }
    }

    /**
     * Draw storm drop
     */
    drawStormDrop(particle) {
        this.ctx.strokeStyle = `rgba(100, 149, 237, ${particle.opacity * particle.intensity})`;
        this.ctx.lineWidth = particle.width;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(particle.x, particle.y);
        this.ctx.lineTo(particle.x + Math.sin(particle.angle * Math.PI / 180) * 5, 
                        particle.y + particle.length);
        this.ctx.stroke();
    }

    /**
     * Add floating weather elements to DOM
     */
    addFloatingElements(weatherType) {
        const container = document.querySelector('.animated-elements');
        if (!container) return;
        
        // Clear existing elements
        container.innerHTML = '';
        
        switch (weatherType) {
            case 'sunny':
                this.addSunRays(container);
                break;
            
            case 'cloudy':
                this.addFloatingClouds(container);
                break;
            
            case 'misty':
                this.addMistElements(container);
                break;
        }
    }

    /**
     * Add sun rays animation
     */
    addSunRays(container) {
        const raysContainer = document.createElement('div');
        raysContainer.className = 'sunny-particles';
        
        for (let i = 0; i < 8; i++) {
            const ray = document.createElement('div');
            ray.className = 'sun-ray';
            ray.style.cssText = `
                left: ${Math.random() * 100}%;
                animation-delay: ${Math.random() * 3}s;
            `;
            raysContainer.appendChild(ray);
        }
        
        container.appendChild(raysContainer);
    }

    /**
     * Add floating clouds
     */
    addFloatingClouds(container) {
        const cloudsData = [
            { class: 'cloud-1', delay: 0 },
            { class: 'cloud-2', delay: 10 },
            { class: 'cloud-3', delay: 20 }
        ];
        
        cloudsData.forEach(cloudData => {
            const cloud = document.createElement('div');
            cloud.className = `cloud ${cloudData.class}`;
            cloud.style.animationDelay = `${cloudData.delay}s`;
            container.appendChild(cloud);
        });
    }

    /**
     * Add mist elements
     */
    addMistElements(container) {
        for (let i = 1; i <= 3; i++) {
            const mist = document.createElement('div');
            mist.className = `mist mist-${i}`;
            container.appendChild(mist);
        }
    }

    /**
     * Add lightning effect
     */
    addLightningEffect() {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        
        const background = document.getElementById('weatherBackground');
        if (background) {
            background.appendChild(lightning);
        }
    }

    /**
     * Pause all animations
     */
    pauseAnimations() {
        this.isAnimating = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    /**
     * Resume animations
     */
    resumeAnimations() {
        if (this.currentWeatherType) {
            this.startAnimation();
        }
    }

    /**
     * Clear all animations
     */
    clearAnimations() {
        this.pauseAnimations();
        this.particles = [];
        
        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Clear DOM elements
        const container = document.querySelector('.animated-elements');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * Update animation settings based on performance
     */
    updateAnimationSettings() {
        if (this.performanceMode === 'low') {
            this.particleCount = 10;
            this.frameRate = 30;
        } else if (this.performanceMode === 'medium') {
            this.particleCount = 35;
            this.frameRate = 45;
        } else {
            this.particleCount = 50;
            this.frameRate = 60;
        }
        
        // Recreate particles with new settings
        if (this.currentWeatherType) {
            this.createParticles(this.currentWeatherType);
        }
    }

    /**
     * Add entrance animations to weather cards
     */
    animateWeatherCards() {
        const cards = document.querySelectorAll('.forecast-card, .detail-card, .hourly-item');
        
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Add pulse animation to temperature
     */
    animateTemperature() {
        const tempElement = document.getElementById('currentTemp');
        if (tempElement) {
            tempElement.classList.add('breathing');
            setTimeout(() => {
                tempElement.classList.remove('breathing');
            }, 4000);
        }
    }

    /**
     * Add ripple effect to button
     */
    addRippleEffect(button, event) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    /**
     * Animate search suggestions
     */
    animateSearchSuggestions(container) {
        const items = container.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-10px)';
            
            setTimeout(() => {
                item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 50);
        });
    }

    /**
     * Cleanup when component is destroyed
     */
    destroy() {
        this.clearAnimations();
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.pauseAnimations);
        window.removeEventListener('resize', this.handleResize);
    }
}
