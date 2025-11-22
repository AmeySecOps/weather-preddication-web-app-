/**
 * Main Application Controller
 * Handles initialization, UI interactions, and app state management
 */

class WeatherApp {
    constructor() {
        this.weatherService = new WeatherService();
        this.animationController = new AnimationController();
        this.currentUnit = 'celsius';
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.searchTimeout = null;
        this.currentLocation = null;
        this.recentSearches = this.loadRecentSearches();
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.setupEventListeners();
            this.setupTheme();
            this.setupServiceWorker();
            await this.loadInitialData();
            this.hideLoadingScreen();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => this.toggleTheme());

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchSuggestions = document.getElementById('searchSuggestions');
        
        searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
        searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));
        searchInput.addEventListener('focus', () => {
            // Show recent searches immediately when focused
            if (searchInput.value.length === 0) {
                this.displayRecentSearches();
            } else {
                this.showSearchSuggestions();
            }
        });
        
        // Location detection
        const locationBtn = document.getElementById('locationBtn');
        locationBtn.addEventListener('click', () => this.getCurrentLocation());

        // Unit toggle
        const unitToggle = document.getElementById('unitToggle');
        unitToggle.addEventListener('click', () => this.toggleUnit());

        // Hourly forecast scrolling
        const scrollLeft = document.getElementById('scrollLeft');
        const scrollRight = document.getElementById('scrollRight');
        const hourlySlider = document.getElementById('hourlySlider');

        scrollLeft.addEventListener('click', () => this.scrollHourly('left'));
        scrollRight.addEventListener('click', () => this.scrollHourly('right'));

        // Touch/swipe support for hourly forecast
        let isDown = false;
        let startX;
        let scrollLeftPos;

        hourlySlider.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - hourlySlider.offsetLeft;
            scrollLeftPos = hourlySlider.scrollLeft;
        });

        hourlySlider.addEventListener('mouseleave', () => {
            isDown = false;
        });

        hourlySlider.addEventListener('mouseup', () => {
            isDown = false;
        });

        hourlySlider.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            e.preventDefault();
            const x = e.pageX - hourlySlider.offsetLeft;
            const walk = (x - startX) * 2;
            hourlySlider.scrollLeft = scrollLeftPos - walk;
        });

        // Touch events for mobile
        let touchStartX = 0;
        hourlySlider.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        hourlySlider.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchX = e.touches[0].clientX;
            const diff = touchStartX - touchX;
            hourlySlider.scrollLeft += diff;
            touchStartX = touchX;
        });

        // Error modal
        const closeError = document.getElementById('closeError');
        closeError.addEventListener('click', () => this.hideError());

        // Global click handler to close search suggestions
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSearchSuggestions();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

        // Window resize handler
        window.addEventListener('resize', () => this.handleResize());

        // Online/offline status
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }

    /**
     * Set up theme based on user preference or system preference
     */
    setupTheme() {
        // Check for saved theme or default to system preference
        if (!localStorage.getItem('theme')) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        this.applyTheme();

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    }

    /**
     * Apply the current theme
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        
        // Save to localStorage
        localStorage.setItem('theme', this.currentTheme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        
        // Add theme transition animation
        document.body.classList.add('theme-transition');
        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 300);
    }

    /**
     * Set up service worker for offline functionality
     */
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed');
                });
        }
    }

    /**
     * Load initial weather data
     */
    async loadInitialData() {
        // Check if API key is available
        if (!this.weatherService.isValidApiKey()) {
            this.showApiKeyRequired();
            return;
        }

        // Try to get user's location first
        try {
            await this.getCurrentLocation();
        } catch (error) {
            // Fallback to default location if geolocation fails
            console.log('Geolocation failed, using default location');
            await this.loadWeatherData('New York');
        }
    }

    /**
     * Get user's current location and load weather data
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            const locationBtn = document.getElementById('locationBtn');
            locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        await this.loadWeatherDataByCoords(latitude, longitude);
                        locationBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
                        resolve();
                    } catch (error) {
                        locationBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
                        reject(error);
                    }
                },
                (error) => {
                    locationBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
                    let errorMessage = 'Location access denied';
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                    }
                    
                    this.showError(errorMessage);
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    }

    /**
     * Load weather data by coordinates
     */
    async loadWeatherDataByCoords(lat, lon) {
        try {
            this.showLoadingScreen();
            const weatherData = await this.weatherService.getWeatherByCoords(lat, lon);
            this.currentLocation = { lat, lon, name: weatherData.location.name };
            await this.updateUI(weatherData);
        } catch (error) {
            console.error('Failed to load weather data by coordinates:', error);
            if (error.message === 'API_KEY_REQUIRED') {
                this.showApiKeyRequired();
            } else {
                this.showError('Failed to load weather data for your location.');
            }
        } finally {
            this.hideLoadingScreen();
        }
    }

    /**
     * Load weather data by city name
     */
    async loadWeatherData(city) {
        try {
            this.showLoadingScreen();
            const weatherData = await this.weatherService.getWeatherByCity(city);
            this.currentLocation = { name: weatherData.location.name };
            await this.updateUI(weatherData);
        } catch (error) {
            console.error('Failed to load weather data:', error);
            if (error.message === 'API_KEY_REQUIRED') {
                this.showApiKeyRequired();
            } else {
                this.showError(`Failed to load weather data for ${city}. Please try another location.`);
            }
        } finally {
            this.hideLoadingScreen();
        }
    }

    /**
     * Show API key required message and load demo data
     */
    async showApiKeyRequired() {
        this.hideLoadingScreen();
        
        // Show demo data
        const demoData = this.weatherService.generateDemoData('Demo Location');
        await this.updateUI(demoData);
        
        // Show API key requirement notice
        this.showError(`To access live weather data, you need a RapidAPI key for WeatherAPI.com. 
        
        Currently showing demo data for demonstration purposes. 
        
        To get live data:
        1. Sign up at rapidapi.com
        2. Subscribe to WeatherAPI
        3. Get your API key
        4. Click 'Try Again' and enter your key when prompted`);
    }

    /**
     * Update the UI with weather data
     */
    async updateUI(weatherData) {
        try {
            // Update current weather
            this.updateCurrentWeather(weatherData.current);
            
            // Update location and date
            this.updateLocationAndDate(weatherData.location);
            
            // Update weather details
            this.updateWeatherDetails(weatherData.current);
            
            // Update sun times
            if (weatherData.forecast && weatherData.forecast.forecastday && weatherData.forecast.forecastday[0]) {
                this.updateSunTimes(weatherData.forecast.forecastday[0].astro);
            }
            
            // Update hourly forecast
            if (weatherData.hourly && weatherData.hourly.length > 0) {
                this.updateHourlyForecast(weatherData.hourly);
            }
            
            // Update daily forecast
            if (weatherData.forecast && weatherData.forecast.forecastday) {
                this.updateDailyForecast(weatherData.forecast.forecastday);
            }
            
            // Update background animation
            this.animationController.updateWeatherBackground(weatherData.current.condition.text);
            
            // Animate elements
            this.animateElements();
            
        } catch (error) {
            console.error('Failed to update UI:', error);
            this.showError('Failed to update the interface. Please try again.');
        }
    }

    /**
     * Update current weather display
     */
    updateCurrentWeather(current) {
        const temp = this.currentUnit === 'celsius' ? current.temp_c : current.temp_f;
        const feelsLike = this.currentUnit === 'celsius' ? current.feelslike_c : current.feelslike_f;
        const unit = this.currentUnit === 'celsius' ? '°C' : '°F';

        document.getElementById('currentTemp').textContent = `${Math.round(temp)}°`;
        document.getElementById('weatherCondition').textContent = current.condition.text;
        document.getElementById('feelsLike').textContent = `Feels like ${Math.round(feelsLike)}°`;
        
        // Update weather icon
        const iconElement = document.getElementById('mainWeatherIcon');
        const iconClass = this.weatherService.getWeatherIcon(current.condition.text);
        iconElement.innerHTML = `<i class="${iconClass}"></i>`;
    }

    /**
     * Update location and date display
     */
    updateLocationAndDate(location) {
        document.getElementById('currentLocation').textContent = location.name;
        
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    }

    /**
     * Update weather details
     */
    updateWeatherDetails(current) {
        const windSpeed = this.currentUnit === 'celsius' ? current.wind_kph : current.wind_mph;
        const windUnit = this.currentUnit === 'celsius' ? 'km/h' : 'mph';
        const visibility = this.currentUnit === 'celsius' ? current.vis_km : current.vis_miles;
        const visUnit = this.currentUnit === 'celsius' ? 'km' : 'mi';
        const pressure = this.currentUnit === 'celsius' ? current.pressure_mb : current.pressure_in;
        const pressureUnit = this.currentUnit === 'celsius' ? 'hPa' : 'inHg';

        document.getElementById('windSpeed').textContent = `${windSpeed} ${windUnit}`;
        document.getElementById('humidity').textContent = `${current.humidity}%`;
        document.getElementById('visibility').textContent = `${visibility} ${visUnit}`;
        document.getElementById('pressure').textContent = `${pressure} ${pressureUnit}`;
        document.getElementById('uvIndex').textContent = current.uv;
        
        // Display calculated air quality
        document.getElementById('airQuality').textContent = current.air_quality || 'Good';
    }

    /**
     * Update sun times
     */
    updateSunTimes(astro) {
        if (astro) {
            document.getElementById('sunrise').textContent = astro.sunrise || '06:00 AM';
            document.getElementById('sunset').textContent = astro.sunset || '06:00 PM';
        }
    }

    /**
     * Update hourly forecast
     */
    updateHourlyForecast(hourlyData) {
        const hourlySlider = document.getElementById('hourlySlider');
        hourlySlider.innerHTML = '';

        // Show all 24 hours of data
        const hoursToShow = hourlyData.slice(0, 24);

        hoursToShow.forEach((hour, index) => {
            const hourElement = this.createHourlyItem(hour, index === 0);
            hourlySlider.appendChild(hourElement);
        });
    }

    /**
     * Create hourly forecast item
     */
    createHourlyItem(hourData, isCurrent = false) {
        const temp = this.currentUnit === 'celsius' ? hourData.temp_c : hourData.temp_f;
        const time = new Date(hourData.time * 1000);
        const timeString = isCurrent ? 'Now' : time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            hour12: true 
        });

        const hourlyItem = document.createElement('div');
        hourlyItem.className = `hourly-item ${isCurrent ? 'current-hour' : ''}`;
        
        const iconClass = this.weatherService.getWeatherIcon(hourData.condition.text);
        
        // Add rain chance if available
        const rainChance = hourData.chance_of_rain || 0;
        const rainChanceText = rainChance > 0 ? ` ${rainChance}%` : '';
        
        hourlyItem.innerHTML = `
            <div class="hourly-time">${timeString}</div>
            <div class="hourly-icon"><i class="${iconClass}"></i></div>
            <div class="hourly-temp">${Math.round(temp)}°</div>
            <div class="hourly-desc">${hourData.condition.text}${rainChanceText}</div>
        `;

        return hourlyItem;
    }

    /**
     * Update daily forecast
     */
    updateDailyForecast(forecastData) {
        const forecastGrid = document.getElementById('forecastGrid');
        forecastGrid.innerHTML = '';

        forecastData.forEach((day, index) => {
            const forecastCard = this.createForecastCard(day, index === 0);
            forecastGrid.appendChild(forecastCard);
        });
    }

    /**
     * Create daily forecast card
     */
    createForecastCard(dayData, isToday = false) {
        const date = new Date(dayData.date);
        const dayName = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const highTemp = this.currentUnit === 'celsius' ? dayData.day.maxtemp_c : dayData.day.maxtemp_f;
        const lowTemp = this.currentUnit === 'celsius' ? dayData.day.mintemp_c : dayData.day.mintemp_f;
        const windSpeed = this.currentUnit === 'celsius' ? dayData.day.maxwind_kph : dayData.day.maxwind_mph;
        const windUnit = this.currentUnit === 'celsius' ? 'km/h' : 'mph';
        
        const iconClass = this.weatherService.getWeatherIcon(dayData.day.condition.text);

        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-card fade-in';
        forecastCard.style.animationDelay = `${Math.random() * 0.5}s`;

        // Format rain chance display
        const rainChance = dayData.day.daily_chance_of_rain || 0;
        const rainChanceText = rainChance > 0 ? `${rainChance}%` : '0%';
        
        forecastCard.innerHTML = `
            <div class="forecast-header">
                <div>
                    <div class="forecast-day">${dayName}</div>
                    <div class="forecast-date">${dateString}</div>
                </div>
            </div>
            <div class="forecast-main">
                <div class="forecast-icon"><i class="${iconClass}"></i></div>
                <div class="forecast-temps">
                    <div class="forecast-high">${Math.round(highTemp)}°</div>
                    <div class="forecast-low">${Math.round(lowTemp)}°</div>
                </div>
            </div>
            <div class="forecast-condition">${dayData.day.condition.text}</div>
            <div class="forecast-details">
                <span class="rain-chance-indicator"><i class="fas fa-tint"></i> ${rainChanceText}</span>
                <span><i class="fas fa-wind"></i> ${Math.round(windSpeed)} ${windUnit}</span>
            </div>
        `;

        return forecastCard;
    }

    /**
     * Handle search input changes
     */
    async handleSearchInput(query) {
        clearTimeout(this.searchTimeout);
        
        if (query.length === 0) {
            // Show recent searches when input is empty
            this.displayRecentSearches();
            return;
        }
        
        if (query.length < 2) {
            this.hideSearchSuggestions();
            return;
        }

        // Show loading state
        this.showSearchLoading();

        // Reduce debounce time for better responsiveness
        this.searchTimeout = setTimeout(async () => {
            try {
                const suggestions = await this.weatherService.searchCities(query);
                this.displaySearchSuggestions(suggestions, query);
            } catch (error) {
                console.error('Search failed:', error);
                this.hideSearchSuggestions();
            }
        }, 200); // Reduced from 300ms to 200ms
    }

    /**
     * Show loading state in search suggestions
     */
    showSearchLoading() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        suggestionsContainer.innerHTML = `
            <div class="suggestion-header">Searching...</div>
            <div class="suggestion-item loading-item">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Searching for cities...</span>
            </div>
        `;
        this.showSearchSuggestions();
    }

    /**
     * Display recent searches
     */
    displayRecentSearches() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        
        if (this.recentSearches.length === 0) {
            // Show default Indian cities when no recent searches
            const defaultCities = [
                { name: 'Mumbai', region: 'Maharashtra', country: 'India' },
                { name: 'Pune', region: 'Maharashtra', country: 'India' },
                { name: 'Satara', region: 'Maharashtra', country: 'India' },
                { name: 'Kolhapur', region: 'Maharashtra', country: 'India' },
                { name: 'Sangli', region: 'Maharashtra', country: 'India' }
            ];
            this.displaySearchSuggestions(defaultCities, '');
            return;
        }

        suggestionsContainer.innerHTML = '';
        
        // Add "Recent Searches" header
        const header = document.createElement('div');
        header.className = 'suggestion-header';
        header.innerHTML = `
            <span>Recent Searches</span>
            <button class="clear-recent-btn" title="Clear recent searches">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Add clear button functionality
        const clearBtn = header.querySelector('.clear-recent-btn');
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearRecentSearches();
        });
        
        suggestionsContainer.appendChild(header);
        
        // Display recent searches
        this.recentSearches.forEach(search => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item recent-search';
            
            suggestionItem.innerHTML = `
                <i class="fas fa-history"></i>
                <span>${search}</span>
            `;
            
            suggestionItem.addEventListener('click', () => {
                this.selectLocation(search);
            });
            
            suggestionsContainer.appendChild(suggestionItem);
        });

        this.showSearchSuggestions();
    }

    /**
     * Clear recent searches
     */
    clearRecentSearches() {
        this.recentSearches = [];
        this.saveRecentSearches();
        this.displayRecentSearches(); // Refresh the display
    }

    /**
     * Display search suggestions
     */
    displaySearchSuggestions(suggestions, query) {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        
        // Predefined Indian cities
        const indianCities = [
            { name: 'Mumbai', state: 'Maharashtra', country: 'India' },
            { name: 'Pune', state: 'Maharashtra', country: 'India' },
            { name: 'Satara', state: 'Maharashtra', country: 'India' },
            { name: 'Kolhapur', state: 'Maharashtra', country: 'India' },
            { name: 'Sangli', state: 'Maharashtra', country: 'India' }
        ].map(city => ({
            ...city,
            displayName: `${city.name}, ${city.state}, ${city.country}`
        }));
        
        // Filter out any suggestions with undefined values and format them
        const filteredSuggestions = suggestions.filter(suggestion => 
            suggestion && suggestion.name && suggestion.country
        );
        
        // Combine API suggestions with predefined cities and remove duplicates
        const allSuggestions = [...filteredSuggestions, ...indianCities]
            .filter((suggestion, index, self) => 
                index === self.findIndex(s => 
                    s.name === suggestion.name && 
                    s.country === suggestion.country
                )
            )
            .slice(0, 5); // Limit to 5 suggestions
        
        // Add Indian cities if they match the search query
        indianCities.forEach(city => {
            if (city.name.toLowerCase().includes(query.toLowerCase()) && 
                !allSuggestions.some(s => s.name === city.name)) {
                allSuggestions.unshift(city); // Add to beginning for priority
            }
        });
        
        if (allSuggestions.length === 0) {
            this.hideSearchSuggestions();
            return;
        }

        suggestionsContainer.innerHTML = '';
        
        // Add "Search Results" header if there's a query
        if (query) {
            const header = document.createElement('div');
            header.className = 'suggestion-header';
            header.textContent = 'Search Results';
            suggestionsContainer.appendChild(header);
        }
        
        allSuggestions.slice(0, 5).forEach((suggestion, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.setAttribute('data-index', index);
            
            // Use displayName if available, otherwise construct it
            const displayName = suggestion.displayName || 
                `${suggestion.name}${suggestion.state ? `, ${suggestion.state}` : ''}${suggestion.country ? `, ${suggestion.country}` : ''}`;
            
            suggestionItem.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                <span>${displayName}</span>
            `;
            
            suggestionItem.addEventListener('click', () => {
                // If we have coordinates, use them for more accurate results
                if (suggestion.lat && suggestion.lon) {
                    this.loadWeatherDataByCoords(suggestion.lat, suggestion.lon);
                } else {
                    this.selectLocation(displayName);
                }
            });
            
            // Add keyboard navigation
            suggestionItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    suggestionItem.click();
                }
            });
            
            suggestionItem.setAttribute('tabindex', '0');
            
            suggestionsContainer.appendChild(suggestionItem);
        });

        this.showSearchSuggestions();
    }

    /**
     * Select a location from suggestions
     */
    async selectLocation(locationName) {
        const searchInput = document.getElementById('searchInput');
        
        // Clear search input and close suggestions immediately
        searchInput.value = '';
        searchInput.blur(); // Remove focus from search input
        this.hideSearchSuggestions();
        
        // Add to recent searches
        this.addToRecentSearches(locationName);
        
        // Show loading state
        this.showLoadingScreen();
        
        try {
            await this.loadWeatherData(locationName);
        } catch (error) {
            console.error('Error loading weather data:', error);
            this.showError('Failed to load weather data. Please try again.');
        } finally {
            this.hideLoadingScreen();
        }
    }

    /**
     * Show search suggestions
     */
    showSearchSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        suggestions.classList.remove('hidden');
    }

    /**
     * Hide search suggestions
     */
    hideSearchSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        suggestions.classList.add('hidden');
    }

    /**
     * Handle search input keydown
     */
    handleSearchKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query) {
                this.hideSearchSuggestions();
                this.loadWeatherData(query);
            }
        } else if (e.key === 'Escape') {
            this.hideSearchSuggestions();
        }
    }

    /**
     * Toggle temperature unit
     */
    toggleUnit() {
        this.currentUnit = this.currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
        const unitBtn = document.getElementById('unitToggle');
        unitBtn.textContent = this.currentUnit === 'celsius' ? '°C' : '°F';
        
        // Refresh current data with new unit
        if (this.currentLocation) {
            if (this.currentLocation.lat && this.currentLocation.lon) {
                this.loadWeatherDataByCoords(this.currentLocation.lat, this.currentLocation.lon);
            } else {
                this.loadWeatherData(this.currentLocation.name);
            }
        }
    }

    /**
     * Scroll hourly forecast
     */
    scrollHourly(direction) {
        const slider = document.getElementById('hourlySlider');
        const scrollAmount = 200;
        
        if (direction === 'left') {
            slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        } else {
            slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.remove('hidden');
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.add('hidden');
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorModal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorModal = document.getElementById('errorModal');
        errorModal.classList.add('hidden');
    }

    /**
     * Animate elements when data loads
     */
    animateElements() {
        // Add fade-in animation to main elements
        const elements = document.querySelectorAll('.hero-content, .weather-details, .sun-times');
        elements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.1}s`;
            element.classList.add('fade-in');
        });
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeydown(e) {
        // Search shortcut (Ctrl/Cmd + K)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
        
        // Theme toggle (Ctrl/Cmd + D)
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            this.toggleTheme();
        }
        
        // Location shortcut (Ctrl/Cmd + L)
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            this.getCurrentLocation();
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Adjust hourly forecast scroll buttons visibility
        const slider = document.getElementById('hourlySlider');
        const scrollLeft = document.getElementById('scrollLeft');
        const scrollRight = document.getElementById('scrollRight');
        
        if (slider.scrollWidth <= slider.clientWidth) {
            scrollLeft.style.display = 'none';
            scrollRight.style.display = 'none';
        } else {
            scrollLeft.style.display = 'flex';
            scrollRight.style.display = 'flex';
        }
    }

    /**
     * Handle online/offline status
     */
    handleOnlineStatus(isOnline) {
        if (!isOnline) {
            this.showError('You are currently offline. Some features may not work properly.');
        }
    }

    /**
     * Load recent searches from localStorage
     */
    loadRecentSearches() {
        try {
            const saved = localStorage.getItem('weatherApp_recentSearches');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading recent searches:', error);
            return [];
        }
    }

    /**
     * Save recent searches to localStorage
     */
    saveRecentSearches() {
        try {
            localStorage.setItem('weatherApp_recentSearches', JSON.stringify(this.recentSearches));
        } catch (error) {
            console.error('Error saving recent searches:', error);
        }
    }

    /**
     * Add a search to recent searches
     */
    addToRecentSearches(locationName) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(item => item !== locationName);
        
        // Add to beginning
        this.recentSearches.unshift(locationName);
        
        // Keep only last 5 searches
        this.recentSearches = this.recentSearches.slice(0, 5);
        
        // Save to localStorage
        this.saveRecentSearches();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherApp = new WeatherApp();
});

// Handle app errors globally
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (window.weatherApp) {
        window.weatherApp.showError('An unexpected error occurred. Please refresh the page.');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.weatherApp) {
        window.weatherApp.showError('A network error occurred. Please check your connection.');
    }
});
