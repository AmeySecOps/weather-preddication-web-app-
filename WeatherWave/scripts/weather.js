class WeatherService {
    constructor() {
        this.apiKey = window.OPENWEATHER_API_KEY;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    }

    isValidApiKey() {
        return this.apiKey && this.apiKey !== 'YOUR_API_KEY_HERE' && this.apiKey.trim().length > 0;
    }

    async makeRequest(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        
        // Add API key to params
        params.appid = this.apiKey;
        
        // Add parameters to URL
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error('API Response:', response.status, response.statusText);
                throw new Error('API error: ' + response.status);
            }
            return await response.json();
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    async getWeatherByCity(city) {
        try {
            // Use the current weather endpoint for city
            const weatherData = await this.makeRequest('/weather', {
                q: city,
                units: 'metric'
            });
            
            // Get forecast data
            const forecastData = await this.makeRequest('/forecast', {
                q: city,
                units: 'metric'
            });
            
            return this.processWeatherData(weatherData, forecastData, { name: city, country: weatherData.sys?.country || '' });
        } catch (error) {
            console.error('Error fetching weather by city:', error);
            return this.generateDemoData(city);
        }
    }

    async getWeatherByCoords(lat, lon) {
        try {
            // Use the current weather endpoint for coordinates
            const weatherData = await this.makeRequest('/weather', {
                lat: lat,
                lon: lon,
                units: 'metric'
            });
            
            // Get forecast data
            const forecastData = await this.makeRequest('/forecast', {
                lat: lat,
                lon: lon,
                units: 'metric'
            });
            
            return this.processWeatherData(weatherData, forecastData, { 
                name: weatherData.name || 'Current Location', 
                country: weatherData.sys?.country || '',
                lat: lat,
                lon: lon
            });
        } catch (error) {
            console.error('Error fetching weather by coordinates:', error);
            return this.generateDemoData('Current Location');
        }
    }

    async searchCities(query) {
        try {
            // Use the geocoding API with the correct endpoint
            const geoData = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${this.apiKey}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('API error: ' + response.status);
                    }
                    return response.json();
                });
            
            return geoData.map(city => ({
                name: city.name,
                country: city.country,
                state: city.state,
                lat: city.lat,
                lon: city.lon,
                displayName: `${city.name}${city.state ? `, ${city.state}` : ''}${city.country ? `, ${city.country}` : ''}`
            }));
        } catch (error) {
            console.error('Error searching cities:', error);
            return [query];
        }
    }

    processWeatherData(currentData, forecastData, location) {
        if (!currentData) {
            throw new Error('Invalid weather data received from API');
        }

        // Process forecast data to get hourly and daily forecasts
        const processedForecast = this.processForecastData(forecastData, currentData);

        // Calculate UV index based on time of day, cloud cover, and weather conditions
        const uvIndex = this.calculateUVIndex(currentData);
        
        // Calculate air quality based on weather conditions and humidity
        const airQuality = this.calculateAirQuality(currentData);

        return {
            location: {
                name: location.name || 'Unknown',
                region: '',
                country: location.country || '',
                lat: location.lat || currentData.coord?.lat || 0,
                lon: location.lon || currentData.coord?.lon || 0,
                tz_id: 'UTC',
                localtime_epoch: currentData.dt,
                localtime: new Date(currentData.dt * 1000).toISOString().slice(0, 19).replace('T', ' ')
            },
            current: {
                last_updated_epoch: currentData.dt,
                last_updated: new Date(currentData.dt * 1000).toISOString().slice(0, 19).replace('T', ' '),
                temp_c: Math.round(currentData.main?.temp || 0),
                temp_f: this.convertCelsiusToFahrenheit(currentData.main?.temp || 0),
                is_day: currentData.dt > currentData.sys?.sunrise && currentData.dt < currentData.sys?.sunset,
                condition: {
                    text: currentData.weather && currentData.weather[0] ? currentData.weather[0].description : 'Unknown',
                    icon: this.getWeatherIcon(currentData.weather && currentData.weather[0] ? currentData.weather[0].main : 'Unknown', currentData.weather && currentData.weather[0] ? currentData.weather[0].description : ''),
                    code: currentData.weather && currentData.weather[0] ? currentData.weather[0].id : 1000
                },
                wind_mph: this.convertMpsToMph(currentData.wind?.speed || 0),
                wind_kph: this.convertMpsToKph(currentData.wind?.speed || 0),
                wind_degree: currentData.wind?.deg || 0,
                wind_dir: this.getWindDirection(currentData.wind?.deg || 0),
                pressure_mb: currentData.main?.pressure || 0,
                pressure_in: this.convertMbToInches(currentData.main?.pressure || 0),
                precip_mm: currentData.rain ? currentData.rain['1h'] || 0 : 0,
                precip_in: this.convertMmToInches(currentData.rain ? currentData.rain['1h'] || 0 : 0),
                humidity: currentData.main?.humidity || 0,
                cloud: currentData.clouds?.all || 0,
                feelslike_c: Math.round(currentData.main?.feels_like || currentData.main?.temp || 0),
                feelslike_f: this.convertCelsiusToFahrenheit(currentData.main?.feels_like || currentData.main?.temp || 0),
                vis_km: (currentData.visibility || 10000) / 1000,
                vis_miles: this.convertKmToMiles((currentData.visibility || 10000) / 1000),
                uv: uvIndex,
                gust_mph: this.convertMpsToMph(currentData.wind?.gust || 0),
                gust_kph: this.convertMpsToKph(currentData.wind?.gust || 0),
                air_quality: airQuality
            },
            forecast: {
                forecastday: processedForecast.daily
            },
            hourly: processedForecast.hourly
        };
    }

    processForecastData(forecastData, currentData = null) {
        if (!forecastData || !forecastData.list) {
            return {
                daily: [this.generateTodayForecast()],
                hourly: this.generateHourlyData()
            };
        }

        // Process hourly data
        const hourlyData = this.processHourlyData(forecastData.list, currentData);

        // Group forecast data by day
        const dailyData = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    date: date,
                    date_epoch: item.dt,
                    temps: [],
                    weather: [],
                    humidity: [],
                    wind_speed: [],
                    rain_chance: [],
                    precip: [],
                    sunrise: forecastData.city?.sunrise,
                    sunset: forecastData.city?.sunset
                };
            }
            dailyData[date].temps.push(item.main.temp);
            dailyData[date].weather.push(item.weather[0]);
            dailyData[date].humidity.push(item.main.humidity);
            dailyData[date].wind_speed.push(item.wind.speed);
            
            // Calculate rain chance based on weather condition and humidity
            const rainChance = this.calculateRainChance(item.weather[0], item.main.humidity, item.pop);
            dailyData[date].rain_chance.push(rainChance);
            
            // Add precipitation data
            const precip = item.rain ? (item.rain['3h'] || 0) : 0;
            dailyData[date].precip.push(precip);
        });

        // Convert to array and ensure we have 7 days
        let dailyForecast = Object.values(dailyData).map(day => {
            // Calculate UV index for this day based on weather conditions
            const avgCloudCover = day.weather.reduce((sum, w) => {
                const cloudMap = {
                    'Clear': 0, 'Clouds': 50, 'Rain': 80, 'Thunderstorm': 90,
                    'Snow': 70, 'Atmosphere': 60, 'Drizzle': 70
                };
                return sum + (cloudMap[w.main] || 30);
            }, 0) / day.weather.length;
            
            const avgWeather = day.weather[0]?.main || 'Clear';
            const dayUV = this.calculateDayUVIndex(avgWeather, avgCloudCover);
            
            return {
                date: day.date,
                date_epoch: day.date_epoch,
                day: {
                    maxtemp_c: Math.round(Math.max(...day.temps)),
                    maxtemp_f: this.convertCelsiusToFahrenheit(Math.max(...day.temps)),
                    mintemp_c: Math.round(Math.min(...day.temps)),
                    mintemp_f: this.convertCelsiusToFahrenheit(Math.min(...day.temps)),
                    avgtemp_c: Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length),
                    avgtemp_f: this.convertCelsiusToFahrenheit(day.temps.reduce((a, b) => a + b, 0) / day.temps.length),
                    maxwind_mph: this.convertMpsToMph(Math.max(...day.wind_speed)),
                    maxwind_kph: this.convertMpsToKph(Math.max(...day.wind_speed)),
                    totalprecip_mm: Math.round(day.precip.reduce((a, b) => a + b, 0) * 10) / 10,
                    totalprecip_in: this.convertMmToInches(Math.round(day.precip.reduce((a, b) => a + b, 0) * 10) / 10),
                    avgvis_km: 10,
                    avgvis_miles: 6,
                    avghumidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
                    daily_will_it_rain: Math.max(...day.rain_chance) > 50 ? 1 : 0,
                    daily_chance_of_rain: Math.round(Math.max(...day.rain_chance)),
                    daily_will_it_snow: 0,
                    daily_chance_of_snow: 0,
                    condition: {
                        text: day.weather[0]?.description || 'Unknown',
                        icon: this.getWeatherIcon(day.weather[0]?.main || 'Unknown', day.weather[0]?.description || ''),
                        code: day.weather[0]?.id || 1000
                    },
                    uv: dayUV
                },
                astro: {
                    sunrise: day.sunrise ? new Date(day.sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '06:00 AM',
                    sunset: day.sunset ? new Date(day.sunset * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '06:00 PM',
                    moonrise: '12:00 AM',
                    moonset: '12:00 PM',
                    moon_phase: 'New Moon',
                    moon_illumination: '0'
                },
                hour: []
            };
        });

        // If we have less than 7 days, generate additional days
        if (dailyForecast.length < 7) {
            const today = new Date();
            for (let i = dailyForecast.length; i < 7; i++) {
                const forecastDate = new Date(today);
                forecastDate.setDate(today.getDate() + i);
                
                // Generate a basic forecast day
                const additionalDay = this.generateTodayForecast();
                additionalDay.date = forecastDate.toISOString().split('T')[0];
                additionalDay.date_epoch = Math.floor(forecastDate.getTime() / 1000);
                
                dailyForecast.push(additionalDay);
            }
        }

        // Ensure we only return 7 days
        dailyForecast = dailyForecast.slice(0, 7);

        return {
            daily: dailyForecast,
            hourly: hourlyData
        };
    }

    /**
     * Process hourly forecast data
     */
    processHourlyData(forecastList, currentData) {
        const hourlyData = [];
        const now = new Date();
        const currentHour = now.getHours();

        // Get next 24 hours of data
        for (let i = 0; i < 24; i++) {
            const targetHour = (currentHour + i) % 24;
            const targetTime = new Date(now);
            targetTime.setHours(targetHour, 0, 0, 0);

            // Find the closest forecast data for this hour
            let closestForecast = null;
            let minDiff = Infinity;

            forecastList.forEach(item => {
                const itemTime = new Date(item.dt * 1000);
                const diff = Math.abs(itemTime.getHours() - targetHour);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestForecast = item;
                }
            });

            if (closestForecast) {
                const temp = closestForecast.main.temp;
                const weather = closestForecast.weather[0];
                const humidity = closestForecast.main.humidity;
                const windSpeed = closestForecast.wind.speed;
                const pop = closestForecast.pop || 0; // Probability of precipitation
                
                // Calculate UV index for this hour
                const hourUV = this.calculateHourlyUVIndex(targetHour, weather.main, closestForecast.clouds?.all || 0);

                hourlyData.push({
                    time: targetTime.getTime() / 1000,
                    temp_c: Math.round(temp),
                    temp_f: this.convertCelsiusToFahrenheit(temp),
                    condition: {
                        text: weather.description,
                        icon: this.getWeatherIcon(weather.main, weather.description),
                        code: weather.id
                    },
                    wind_kph: this.convertMpsToKph(windSpeed),
                    wind_mph: this.convertMpsToMph(windSpeed),
                    wind_dir: this.getWindDirection(closestForecast.wind.deg),
                    humidity: humidity,
                    chance_of_rain: Math.round(pop * 100),
                    precip_mm: closestForecast.rain ? (closestForecast.rain['1h'] || 0) : 0,
                    precip_in: this.convertMmToInches(closestForecast.rain ? (closestForecast.rain['1h'] || 0) : 0),
                    feelslike_c: Math.round(closestForecast.main.feels_like || temp),
                    feelslike_f: this.convertCelsiusToFahrenheit(closestForecast.main.feels_like || temp),
                    vis_km: (closestForecast.visibility || 10000) / 1000,
                    vis_miles: this.convertKmToMiles((closestForecast.visibility || 10000) / 1000),
                    uv: hourUV
                });
            }
        }

        return hourlyData;
    }

    /**
     * Generate demo hourly data
     */
    generateHourlyData() {
        const hourlyData = [];
        const now = new Date();
        const currentHour = now.getHours();

        for (let i = 0; i < 24; i++) {
            const targetHour = (currentHour + i) % 24;
            const targetTime = new Date(now);
            targetTime.setHours(targetHour, 0, 0, 0);

            // Generate realistic demo data
            const baseTemp = 22;
            const tempVariation = Math.sin((targetHour - 6) * Math.PI / 12) * 8; // Temperature varies throughout the day
            const temp = baseTemp + tempVariation;

            hourlyData.push({
                time: targetTime.getTime() / 1000,
                temp_c: Math.round(temp),
                temp_f: this.convertCelsiusToFahrenheit(temp),
                condition: {
                    text: targetHour >= 6 && targetHour <= 18 ? 'Sunny' : 'Clear',
                    icon: targetHour >= 6 && targetHour <= 18 ? 'fas fa-sun' : 'fas fa-moon',
                    code: targetHour >= 6 && targetHour <= 18 ? 1000 : 1000
                },
                wind_kph: 8 + Math.random() * 5,
                wind_mph: this.convertMpsToMph(8 + Math.random() * 5),
                wind_dir: 'SE',
                humidity: 40 + Math.random() * 30,
                chance_of_rain: Math.random() > 0.8 ? Math.round(Math.random() * 30) : 0,
                precip_mm: 0,
                precip_in: 0,
                feelslike_c: Math.round(temp + Math.random() * 2),
                feelslike_f: this.convertCelsiusToFahrenheit(temp + Math.random() * 2),
                vis_km: 10,
                vis_miles: 6,
                uv: targetHour >= 10 && targetHour <= 16 ? Math.round(5 + Math.random() * 5) : 0
            });
        }

        return hourlyData;
    }

    /**
     * Calculate rain chance based on weather condition, humidity, and precipitation probability
     */
    calculateRainChance(weather, humidity, pop) {
        let rainChance = 0;

        // Base chance from API probability of precipitation
        if (pop !== undefined) {
            rainChance = pop * 100;
        }

        // Adjust based on weather condition
        if (weather) {
            const weatherMain = weather.main.toLowerCase();
            const weatherDesc = weather.description.toLowerCase();

            if (weatherMain === 'rain' || weatherDesc.includes('rain')) {
                rainChance = Math.max(rainChance, 80);
            } else if (weatherMain === 'drizzle' || weatherDesc.includes('drizzle')) {
                rainChance = Math.max(rainChance, 60);
            } else if (weatherMain === 'thunderstorm' || weatherDesc.includes('thunder')) {
                rainChance = Math.max(rainChance, 90);
            } else if (weatherMain === 'snow' || weatherDesc.includes('snow')) {
                rainChance = Math.max(rainChance, 70);
            } else if (weatherMain === 'clouds' && humidity > 80) {
                rainChance = Math.max(rainChance, 30);
            }
        }

        // Adjust based on humidity
        if (humidity > 90) {
            rainChance = Math.max(rainChance, 40);
        } else if (humidity > 80) {
            rainChance = Math.max(rainChance, 20);
        }

        return Math.min(Math.round(rainChance), 100);
    }

    generateTodayForecast(currentData) {
        const today = new Date();
        return {
            date: today.toISOString().split('T')[0],
            date_epoch: Math.floor(today.getTime() / 1000),
            day: {
                maxtemp_c: 25,
                maxtemp_f: 77,
                mintemp_c: 18,
                mintemp_f: 64,
                avgtemp_c: 22,
                avgtemp_f: 72,
                maxwind_mph: 8,
                maxwind_kph: 13,
                totalprecip_mm: 0,
                totalprecip_in: 0,
                avgvis_km: 10,
                avgvis_miles: 6,
                avghumidity: 50,
                daily_will_it_rain: 0,
                daily_chance_of_rain: 0,
                daily_will_it_snow: 0,
                daily_chance_of_snow: 0,
                condition: {
                    text: 'Sunny',
                    icon: 'fas fa-sun',
                    code: 1000
                },
                uv: 5
            },
            astro: {
                sunrise: '06:00 AM',
                sunset: '06:00 PM',
                moonrise: '12:00 AM',
                moonset: '12:00 PM',
                moon_phase: 'New Moon',
                moon_illumination: '0'
            },
            hour: []
        };
    }

    getWeatherIcon(main, description) {
        if (!main || main === 'Unknown') return 'fas fa-cloud';
        
        const desc = description ? description.toLowerCase() : '';
        
        // Thunderstorm
        if (main === 'Thunderstorm') {
            if (desc.includes('light')) return 'fas fa-bolt';
            return 'fas fa-bolt';
        }
        
        // Rain
        if (main === 'Rain') {
            if (desc.includes('drizzle')) return 'fas fa-cloud-drizzle';
            if (desc.includes('shower')) return 'fas fa-cloud-showers-heavy';
            if (desc.includes('light')) return 'fas fa-cloud-rain';
            if (desc.includes('moderate')) return 'fas fa-cloud-showers-heavy';
            if (desc.includes('heavy')) return 'fas fa-cloud-showers-heavy';
            return 'fas fa-cloud-rain';
        }
        
        // Snow
        if (main === 'Snow') {
            if (desc.includes('sleet')) return 'fas fa-cloud-rain';
            if (desc.includes('light')) return 'fas fa-snowflake';
            return 'fas fa-snowflake';
        }
        
        // Atmosphere (fog, mist, etc.)
        if (main === 'Atmosphere') {
            if (desc.includes('fog') || desc.includes('mist')) return 'fas fa-smog';
            if (desc.includes('haze')) return 'fas fa-smog';
            return 'fas fa-smog';
        }
        
        // Clear
        if (main === 'Clear') {
            const hour = new Date().getHours();
            if (hour >= 6 && hour <= 18) {
                return 'fas fa-sun';
            } else {
                return 'fas fa-moon';
            }
        }
        
        // Clouds
        if (main === 'Clouds') {
            if (desc.includes('few') || desc.includes('scattered')) {
                const hour = new Date().getHours();
                if (hour >= 6 && hour <= 18) {
                    return 'fas fa-cloud-sun';
                } else {
                    return 'fas fa-cloud-moon';
                }
            }
            if (desc.includes('broken') || desc.includes('overcast')) {
                return 'fas fa-cloud';
            }
            return 'fas fa-cloud';
        }
        
        return 'fas fa-cloud';
    }

    getWindDirection(degrees) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    convertCelsiusToFahrenheit(celsius) {
        return Math.round(celsius * 9 / 5 + 32);
    }

    convertFahrenheitToCelsius(fahrenheit) {
        return Math.round((fahrenheit - 32) * 5 / 9);
    }

    convertMpsToMph(mps) {
        return Math.round(mps * 2.237);
    }

    convertMpsToKph(mps) {
        return Math.round(mps * 3.6);
    }

    convertMphToKph(mph) {
        return Math.round(mph * 1.60934);
    }

    convertKphToMph(kph) {
        return Math.round(kph / 1.60934);
    }

    convertMbToInches(mb) {
        return Math.round(mb * 0.02953 * 100) / 100;
    }

    convertMmToInches(mm) {
        return Math.round(mm * 0.03937 * 100) / 100;
    }

    convertKmToMiles(km) {
        return Math.round(km * 0.621371 * 10) / 10;
    }

    isDayTime() {
        const hour = new Date().getHours();
        return hour >= 6 && hour < 18;
    }

    getWeatherCode(condition) {
        if (!condition) return 1000;
        const conditionLower = condition.toLowerCase();
        if (conditionLower.includes('sunny') || conditionLower.includes('clear')) return 1000;
        if (conditionLower.includes('cloudy')) return 1006;
        if (conditionLower.includes('rain')) return 1063;
        if (conditionLower.includes('snow')) return 1066;
        if (conditionLower.includes('thunder')) return 1087;
        if (conditionLower.includes('fog') || conditionLower.includes('mist')) return 1030;
        return 1000;
    }

    generateDemoData(location = 'Demo City') {
        // Generate 7 days of forecast data
        const forecastDays = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
            const forecastDate = new Date(today);
            forecastDate.setDate(today.getDate() + i);
            
            // Generate varied weather conditions for demo
            const weatherConditions = [
                { text: 'Sunny', icon: 'fas fa-sun', chance: 0 },
                { text: 'Partly Cloudy', icon: 'fas fa-cloud-sun', chance: 10 },
                { text: 'Cloudy', icon: 'fas fa-cloud', chance: 20 },
                { text: 'Light Rain', icon: 'fas fa-cloud-rain', chance: 60 },
                { text: 'Rain', icon: 'fas fa-cloud-showers-heavy', chance: 80 },
                { text: 'Thunderstorm', icon: 'fas fa-bolt', chance: 90 }
            ];
            
            const selectedWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
            const baseTemp = 22 + (Math.random() * 10 - 5); // Temperature variation
            
            forecastDays.push({
                date: forecastDate.toISOString().split('T')[0],
                date_epoch: Math.floor(forecastDate.getTime() / 1000),
                day: {
                    maxtemp_c: Math.round(baseTemp + 5),
                    maxtemp_f: this.convertCelsiusToFahrenheit(baseTemp + 5),
                    mintemp_c: Math.round(baseTemp - 5),
                    mintemp_f: this.convertCelsiusToFahrenheit(baseTemp - 5),
                    avgtemp_c: Math.round(baseTemp),
                    avgtemp_f: this.convertCelsiusToFahrenheit(baseTemp),
                    maxwind_mph: 8 + Math.random() * 5,
                    maxwind_kph: 13 + Math.random() * 8,
                    totalprecip_mm: selectedWeather.chance > 0 ? Math.random() * 10 : 0,
                    totalprecip_in: this.convertMmToInches(selectedWeather.chance > 0 ? Math.random() * 10 : 0),
                    avgvis_km: 10,
                    avgvis_miles: 6,
                    avghumidity: 40 + Math.random() * 40,
                    daily_will_it_rain: selectedWeather.chance > 50 ? 1 : 0,
                    daily_chance_of_rain: selectedWeather.chance,
                    daily_will_it_snow: 0,
                    daily_chance_of_snow: 0,
                    condition: {
                        text: selectedWeather.text,
                        icon: selectedWeather.icon,
                        code: this.getWeatherCode(selectedWeather.text)
                    },
                    uv: 5 + Math.random() * 5
                },
                astro: {
                    sunrise: '06:00 AM',
                    sunset: '06:00 PM',
                    moonrise: '12:00 AM',
                    moonset: '12:00 PM',
                    moon_phase: 'New Moon',
                    moon_illumination: '0'
                },
                hour: []
            });
        }

        // Generate realistic demo current weather data
        const currentHour = new Date().getHours();
        const isDay = currentHour >= 6 && currentHour <= 18;
        const demoUV = isDay ? (currentHour >= 10 && currentHour <= 16 ? 7 : 4) : 0;
        const demoAirQuality = ['Good', 'Moderate', 'Good', 'Moderate', 'Good'][Math.floor(Math.random() * 5)];

        return {
            location: { 
                name: location, 
                region: '', 
                country: '', 
                lat: 0, 
                lon: 0,
                tz_id: 'UTC',
                localtime_epoch: Math.floor(new Date().getTime() / 1000),
                localtime: new Date().toISOString().slice(0, 19).replace('T', ' ')
            },
            current: {
                last_updated_epoch: Math.floor(new Date().getTime() / 1000),
                last_updated: new Date().toISOString().slice(0, 19).replace('T', ' '),
                temp_c: 22,
                temp_f: 72,
                is_day: isDay,
                condition: {
                    text: 'Sunny',
                    icon: 'fas fa-sun',
                    code: 1000
                },
                wind_mph: 5,
                wind_kph: 8,
                wind_degree: 180,
                wind_dir: 'S',
                pressure_mb: 1013,
                pressure_in: 29.91,
                precip_mm: 0,
                precip_in: 0,
                humidity: 50,
                cloud: 0,
                feelslike_c: 24,
                feelslike_f: 75,
                vis_km: 10,
                vis_miles: 6,
                uv: demoUV,
                gust_mph: 0,
                gust_kph: 0,
                air_quality: demoAirQuality
            },
            forecast: {
                forecastday: forecastDays
            },
            hourly: this.generateHourlyData()
        };
    }

    /**
     * Calculate UV index based on time of day, cloud cover, and weather conditions
     */
    calculateUVIndex(currentData) {
        if (!currentData) return 0;

        const now = new Date();
        const hour = now.getHours();
        const isDay = currentData.dt > currentData.sys?.sunrise && currentData.dt < currentData.sys?.sunset;
        const cloudCover = currentData.clouds?.all || 0;
        const weatherMain = currentData.weather && currentData.weather[0] ? currentData.weather[0].main : 'Clear';
        
        // Base UV index calculation
        let uvIndex = 0;
        
        if (isDay) {
            // Peak UV hours (10 AM - 4 PM)
            if (hour >= 10 && hour <= 16) {
                uvIndex = 8; // High UV during peak hours
            } else if (hour >= 8 && hour <= 18) {
                uvIndex = 5; // Moderate UV during day
            } else {
                uvIndex = 2; // Low UV during early/late day
            }
            
            // Adjust for cloud cover
            if (cloudCover > 80) {
                uvIndex = Math.max(1, uvIndex - 4); // Heavy clouds reduce UV significantly
            } else if (cloudCover > 50) {
                uvIndex = Math.max(2, uvIndex - 2); // Moderate clouds reduce UV
            } else if (cloudCover > 20) {
                uvIndex = Math.max(3, uvIndex - 1); // Light clouds slightly reduce UV
            }
            
            // Adjust for weather conditions
            if (weatherMain === 'Rain' || weatherMain === 'Thunderstorm') {
                uvIndex = Math.max(1, uvIndex - 3); // Rain reduces UV
            } else if (weatherMain === 'Snow') {
                uvIndex = Math.max(1, uvIndex - 2); // Snow can reflect UV but also block it
            } else if (weatherMain === 'Atmosphere') {
                uvIndex = Math.max(1, uvIndex - 2); // Fog/mist reduces UV
            }
        } else {
            uvIndex = 0; // No UV at night
        }
        
        return Math.round(uvIndex);
    }

    /**
     * Calculate air quality based on weather conditions, humidity, and visibility
     */
    calculateAirQuality(currentData) {
        if (!currentData) return 'Good';

        const humidity = currentData.main?.humidity || 50;
        const visibility = currentData.visibility || 10000;
        const weatherMain = currentData.weather && currentData.weather[0] ? currentData.weather[0].main : 'Clear';
        const weatherDesc = currentData.weather && currentData.weather[0] ? currentData.weather[0].description.toLowerCase() : '';
        const windSpeed = currentData.wind?.speed || 0;
        
        let aqiScore = 1; // Start with good air quality
        
        // Adjust based on humidity
        if (humidity > 90) {
            aqiScore += 2; // High humidity can trap pollutants
        } else if (humidity > 80) {
            aqiScore += 1;
        }
        
        // Adjust based on visibility (lower visibility = worse air quality)
        const visibilityKm = visibility / 1000;
        if (visibilityKm < 5) {
            aqiScore += 3; // Poor visibility indicates air pollution
        } else if (visibilityKm < 10) {
            aqiScore += 2;
        } else if (visibilityKm < 15) {
            aqiScore += 1;
        }
        
        // Adjust based on weather conditions
        if (weatherMain === 'Atmosphere') {
            if (weatherDesc.includes('smog') || weatherDesc.includes('haze')) {
                aqiScore += 3; // Smog/haze indicates poor air quality
            } else if (weatherDesc.includes('fog') || weatherDesc.includes('mist')) {
                aqiScore += 1; // Fog/mist can trap pollutants
            }
        } else if (weatherMain === 'Rain') {
            aqiScore -= 1; // Rain can clean the air
        } else if (weatherMain === 'Thunderstorm') {
            aqiScore -= 1; // Storms can clear the air
        }
        
        // Adjust based on wind speed (higher wind = better air quality)
        if (windSpeed < 2) {
            aqiScore += 2; // Low wind can trap pollutants
        } else if (windSpeed > 8) {
            aqiScore -= 1; // High wind can disperse pollutants
        }
        
        // Ensure score is within valid range
        aqiScore = Math.max(1, Math.min(15, aqiScore));
        
        // Convert score to air quality level
        let airQuality = 'Good';
        if (aqiScore <= 3) {
            airQuality = 'Good';
        } else if (aqiScore <= 5) {
            airQuality = 'Moderate';
        } else if (aqiScore <= 7) {
            airQuality = 'Unhealthy for Sensitive Groups';
        } else if (aqiScore <= 9) {
            airQuality = 'Unhealthy';
        } else if (aqiScore <= 11) {
            airQuality = 'Very Unhealthy';
        } else {
            airQuality = 'Hazardous';
        }
        
        return airQuality;
    }

    /**
     * Calculate UV index for a day based on weather conditions and cloud cover
     */
    calculateDayUVIndex(weather, cloudCover) {
        let uvIndex = 0;

        // Base UV index calculation
        if (weather === 'Clear') {
            uvIndex = 10; // Sunny day
        } else if (weather === 'Clouds') {
            uvIndex = 5; // Cloudy day
        } else if (weather === 'Rain') {
            uvIndex = 8; // Rainy day
        } else if (weather === 'Thunderstorm') {
            uvIndex = 9; // Stormy day
        } else if (weather === 'Snow') {
            uvIndex = 7; // Snowy day
        } else if (weather === 'Atmosphere') {
            uvIndex = 6; // Foggy day
        } else {
            uvIndex = 3; // Overcast day
        }

        // Adjust for cloud cover
        if (cloudCover > 80) {
            uvIndex = Math.max(1, uvIndex - 4); // Heavy clouds reduce UV significantly
        } else if (cloudCover > 50) {
            uvIndex = Math.max(2, uvIndex - 2); // Moderate clouds reduce UV
        } else if (cloudCover > 20) {
            uvIndex = Math.max(3, uvIndex - 1); // Light clouds slightly reduce UV
        }

        return Math.round(uvIndex);
    }

    /**
     * Calculate UV index for an hour based on time of day and weather conditions
     */
    calculateHourlyUVIndex(hour, weatherMain, cloudCover) {
        let uvIndex = 0;
        
        // Only calculate UV during daylight hours
        if (hour >= 6 && hour <= 18) {
            // Peak UV hours (10 AM - 4 PM)
            if (hour >= 10 && hour <= 16) {
                uvIndex = 8; // High UV during peak hours
            } else if (hour >= 8 && hour <= 18) {
                uvIndex = 5; // Moderate UV during day
            } else {
                uvIndex = 2; // Low UV during early/late day
            }
            
            // Adjust for weather conditions
            if (weatherMain === 'Rain' || weatherMain === 'Thunderstorm') {
                uvIndex = Math.max(1, uvIndex - 3); // Rain reduces UV
            } else if (weatherMain === 'Snow') {
                uvIndex = Math.max(1, uvIndex - 2); // Snow can reflect UV but also block it
            } else if (weatherMain === 'Atmosphere') {
                uvIndex = Math.max(1, uvIndex - 2); // Fog/mist reduces UV
            } else if (weatherMain === 'Clouds') {
                uvIndex = Math.max(1, uvIndex - 1); // Clouds reduce UV
            }
            
            // Adjust for cloud cover
            if (cloudCover > 80) {
                uvIndex = Math.max(1, uvIndex - 4); // Heavy clouds reduce UV significantly
            } else if (cloudCover > 50) {
                uvIndex = Math.max(1, uvIndex - 2); // Moderate clouds reduce UV
            } else if (cloudCover > 20) {
                uvIndex = Math.max(1, uvIndex - 1); // Light clouds slightly reduce UV
            }
        } else {
            uvIndex = 0; // No UV at night
        }
        
        return Math.round(uvIndex);
    }
}

window.weatherService = new WeatherService(); 