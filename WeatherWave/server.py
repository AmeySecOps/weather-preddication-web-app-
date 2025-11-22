#!/usr/bin/env python3
"""
Weather App Server
Serves the weather application with proper API key injection
"""

import os
import http.server
import socketserver
from urllib.parse import urlparse

class WeatherHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Handle config.js with API key injection
        if parsed_path.path == '/config.js':
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            
            # Get API key from environment
            api_key = os.environ.get('RAPIDAPI_KEY', 'YOUR_RAPIDAPI_KEY_HERE')
            config_content = f"window.RAPIDAPI_KEY = '{api_key}';"
            
            self.wfile.write(config_content.encode('utf-8'))
            return
        
        # Handle all other requests normally
        super().do_GET()

def main():
    PORT = 5000
    
    with socketserver.TCPServer(("", PORT), WeatherHandler) as httpd:
        print(f"Serving weather app at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()