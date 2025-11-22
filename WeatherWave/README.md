# WeatherBuddy - Weather Application

A beautiful weather application that provides current weather conditions and forecasts.

## Features
- Current weather conditions
- 5-day forecast
- Responsive design
- Dark/Light theme
- Location search

## Deployment

This application is configured to be deployed on Vercel:

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Deploy to Vercel:
   ```bash
   vercel
   ```

3. Set the environment variable:
   - Go to your Vercel project settings
   - Add environment variable: `RAPIDAPI_KEY` with your RapidAPI key

## Development

To run locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   python server.py
   ```
   
   The application will be available at http://localhost:5000

## Environment Variables

- `RAPIDAPI_KEY`: Your RapidAPI key for weather data
