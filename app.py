from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
import pickle
import numpy as np
import pandas as pd
import os
import logging
import requests
from datetime import datetime, timedelta
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# DATABASE & AUTH HELPERS
# ============================================================================
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


filename = 'random_forest_regression_model.pkl'

if not os.path.isfile(filename):
    error_msg = f"{filename} not found. Run 'python train_model.py' to create it."
    logger.error(error_msg)
    raise FileNotFoundError(error_msg)

with open(filename, 'rb') as f:
    model = pickle.load(f)
logger.info(f"Model loaded successfully from {filename}")

# Initialize Flask application
app = Flask(__name__)
# Set secret key for sessions
app.secret_key = 'super_secret_airsense_key'

# OpenWeather API configuration
OPENWEATHER_API_KEY = "59749f6e704094cf19944a650881cdff"
OPENWEATHER_BASE_URL = "http://api.openweathermap.org/data/2.5"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_aqi_category(aqi_value):
    """
    Determine AQI category based on predicted value.
    
    Args:
        aqi_value (float): Predicted AQI value
        
    Returns:
        dict: Contains category name, color, and health message
    """
    aqi = float(aqi_value)
    
    if aqi <= 50:
        return {
            'category': 'Good',
            'color': '#00B050',
            'emoji': '😊',
            'message': 'Air quality is satisfactory. Enjoy your outdoor activities!',
            'level': 1
        }
    elif aqi <= 100:
        return {
            'category': 'Moderate',
            'color': '#FFC000',
            'emoji': '🙂',
            'message': 'Air quality is acceptable. Sensitive groups may experience issues.',
            'level': 2
        }
    elif aqi <= 150:
        return {
            'category': 'Unhealthy for Sensitive Groups',
            'color': '#FF9500',
            'emoji': '😷',
            'message': 'Sensitive groups should limit outdoor activities.',
            'level': 3
        }
    elif aqi <= 200:
        return {
            'category': 'Unhealthy',
            'color': '#FF5500',
            'emoji': '😠',
            'message': 'Everyone should reduce outdoor exertion.',
            'level': 4
        }
    elif aqi <= 300:
        return {
            'category': 'Very Unhealthy',
            'color': '#950003',
            'emoji': '☠️',
            'message': 'Avoid outdoor activities. Serious health risk.',
            'level': 5
        }
    else:
        return {
            'category': 'Hazardous',
            'color': '#4B0082',
            'emoji': '⛔',
            'message': 'Health emergency. Stay indoors immediately!',
            'level': 6
        }


def normalize_prediction(aqi_value):
    """Ensure AQI value is within reasonable bounds (0-500)"""
    aqi = float(aqi_value)
    return max(0, min(aqi, 500))


# Global storage for sensor data
sensor_data = {
    'temperature': 0,
    'humidity': 0,
    'gas_value': 0,
    'last_updated': None
}

# ============================================================================
# FLASK ROUTES - AUTH & DASHBOARD
# ============================================================================

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('signup'))

        hashed_password = generate_password_hash(password)
        conn = get_db_connection()
        try:
            conn.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                         (username, email, hashed_password))
            conn.commit()
            flash('Account created successfully! Please login.', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('Username or email already exists.', 'error')
            return redirect(url_for('signup'))
        finally:
            conn.close()

    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            flash('Logged in successfully.', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'error')

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('home'))


@app.route('/dashboard')
@login_required
def dashboard():
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    
    # Get last 50 readings for this user (or default user 1 for imported hardware data)
    history_rows = conn.execute(
        'SELECT * FROM air_quality_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50', 
        (session['user_id'],)
    ).fetchall()
    conn.close()

    # Convert rows to dicts
    history = [dict(row) for row in history_rows]
    
    latest = history[0] if history else None
    
    return render_template('dashboard.html', user=user, history=history, latest=latest, history_json=json.dumps(history))


# ============================================================================
# FLASK ROUTES - EXISTING
# ============================================================================

@app.route('/predict_sensor', methods=['GET', 'POST'])
def predict_sensor():
    """
    Handle sensor data from ESP32/Arduino and serve the dashboard.
    
    POST: Ingest data from hardware.
    GET: Serve the sensor monitoring page.
    """
    global sensor_data
    
    if request.method == 'POST':
        try:
            # Try to get JSON data
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data received'}), 400
                
            # Update global sensor state
            sensor_data['temperature'] = float(data.get('temperature', 0))
            sensor_data['humidity'] = float(data.get('humidity', 0))
            sensor_data['gas_value'] = float(data.get('gas_value', 0))
            sensor_data['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Map sensor data to ML model features (Simplification for hardware)
            # T, TM, Tm, SLP, H, VV, V, VM
            # We use sensor T and H, and defaults for others
            features_df = pd.DataFrame([[
                sensor_data['temperature'], # T
                sensor_data['temperature'] + 2, # TM (est)
                sensor_data['temperature'] - 2, # Tm (est)
                1013.25, # SLP (default)
                sensor_data['humidity'], # H
                10.0, # VV (default)
                2.0, # V (default)
                5.0  # VM (default)
            ]], columns=['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM'])
            
            # Make prediction
            prediction = model.predict(features_df)[0]
            prediction = normalize_prediction(prediction)
            category_info = get_aqi_category(prediction)
            
            logger.info(f"Hardware Data Received: T={sensor_data['temperature']}, H={sensor_data['humidity']}, Gas={sensor_data['gas_value']}")
            
            # Save to Database
            # We'll assign it to user_id=1 as the hardware doesn't know about user sessions
            conn = get_db_connection()
            try:
                conn.execute('''
                    INSERT INTO air_quality_history (user_id, temperature, humidity, gas_value, aqi)
                    VALUES (?, ?, ?, ?, ?)
                ''', (1, sensor_data['temperature'], sensor_data['humidity'], sensor_data['gas_value'], prediction))
                conn.commit()
            except Exception as e:
                logger.error(f"Failed to save history to DB: {e}")
            finally:
                conn.close()
            
            return jsonify({
                'success': True,
                'aqi': round(prediction, 2),
                'category': category_info['category'],
                'color': category_info['color']
            }), 200
            
        except Exception as e:
            logger.error(f"Error processing sensor data: {str(e)}")
            return jsonify({'error': str(e)}), 500
            
    # GET request: Serve the dashboard
    return render_template('predict_sensor.html', data=sensor_data)


@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    """API endpoint for fetching the latest sensor data periodically"""
    return jsonify(sensor_data), 200


@app.route('/')
def home():
    """Serve the home page with navigation options"""
    return render_template('home.html')


@app.route('/predict')
def predict_page():
    """Serve the AQI prediction dashboard page"""
    return render_template('index.html')


@app.route('/monitor')
def monitor_page():
    """Serve the live AQI monitoring page"""
    return render_template('monitor.html')


@app.route('/api/predict', methods=['POST'])
def predict_aqi():
    """
    API endpoint for AQI prediction.
    
    Expected JSON input:
    {
        "T": float,        # Temperature (°C)
        "TM": float,       # Max Temperature (°C)
        "Tm": float,       # Min Temperature (°C)
        "SLP": float,      # Sea Level Pressure (hPa)
        "H": float,        # Humidity (%)
        "VV": float,       # Visibility (km)
        "V": float,        # Wind Speed (m/s)
        "VM": float        # Max Wind Speed (m/s)
    }
    
    Returns:
        JSON with predicted AQI and category information
    """
    try:
        data = request.get_json()
        
        # Validate input
        required_fields = ['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing field: {field}'}), 400
        
        # Extract features in correct order with column names
        feature_names = ['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM']
        features_df = pd.DataFrame([[
            float(data['T']),
            float(data['TM']),
            float(data['Tm']),
            float(data['SLP']),
            float(data['H']),
            float(data['VV']),
            float(data['V']),
            float(data['VM'])
        ]], columns=feature_names)
        
        # Make prediction
        prediction = model.predict(features_df)[0]
        prediction = normalize_prediction(prediction)
        
        # Get AQI category
        category_info = get_aqi_category(prediction)
        
        logger.info(f"Prediction made: AQI={prediction:.2f}, Category={category_info['category']}")
        
        return jsonify({
            'success': True,
            'aqi': round(prediction, 2),
            'category': category_info['category'],
            'color': category_info['color'],
            'emoji': category_info['emoji'],
            'message': category_info['message'],
            'level': category_info['level']
        }), 200
        
    except ValueError as e:
        logger.error(f"Value error in prediction: {str(e)}")
        return jsonify({'error': f'Invalid input values: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Unexpected error in prediction: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({'status': 'healthy', 'model': 'ready'}), 200


@app.route('/api/live-aqi', methods=['GET'])
def get_live_aqi():
    """
    Get live AQI data for a city using OpenWeather API
    
    Query parameters:
    - city: City name (required)
    """
    try:
        city = request.args.get('city')
        if not city:
            return jsonify({'error': 'City parameter is required'}), 400
        
        # Get current weather data
        weather_url = f"{OPENWEATHER_BASE_URL}/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
        weather_response = requests.get(weather_url)
        
        if weather_response.status_code != 200:
            return jsonify({'error': f'Failed to get weather data for {city}'}), 404
        
        weather_data = weather_response.json()
        
        # Extract weather parameters
        temp = weather_data['main']['temp']
        temp_max = weather_data['main']['temp_max']
        temp_min = weather_data['main']['temp_min']
        pressure = weather_data['main']['pressure']
        humidity = weather_data['main']['humidity']
        visibility = weather_data.get('visibility', 10000) / 1000  # Convert to km
        wind_speed = weather_data['wind']['speed']
        wind_max = weather_data['wind'].get('gust', wind_speed)
        
        # Use our ML model to predict AQI
        feature_names = ['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM']
        features_df = pd.DataFrame([[
            temp, temp_max, temp_min, pressure, humidity, visibility, wind_speed, wind_max
        ]], columns=feature_names)
        
        predicted_aqi = model.predict(features_df)[0]
        predicted_aqi = normalize_prediction(predicted_aqi)
        
        # Get AQI category
        category_info = get_aqi_category(predicted_aqi)
        
        # Get air pollution data if available
        pollution_data = None
        try:
            lat = weather_data['coord']['lat']
            lon = weather_data['coord']['lon']
            pollution_url = f"{OPENWEATHER_BASE_URL}/air_pollution?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}"
            pollution_response = requests.get(pollution_url)
            
            if pollution_response.status_code == 200:
                pollution_data = pollution_response.json()
        except:
            pass  # Pollution data is optional
        
        response_data = {
            'city': city,
            'country': weather_data['sys'].get('country', ''),
            'coordinates': {
                'lat': weather_data['coord']['lat'],
                'lon': weather_data['coord']['lon']
            },
            'weather': {
                'temperature': temp,
                'temp_max': temp_max,
                'temp_min': temp_min,
                'pressure': pressure,
                'humidity': humidity,
                'visibility': visibility,
                'wind_speed': wind_speed,
                'wind_max': wind_max,
                'description': weather_data['weather'][0]['description'],
                'icon': weather_data['weather'][0]['icon']
            },
            'aqi_prediction': {
                'value': round(predicted_aqi, 2),
                'category': category_info['category'],
                'color': category_info['color'],
                'message': category_info['message'],
                'level': category_info['level']
            }
        }
        
        if pollution_data:
            response_data['air_pollution'] = pollution_data['list'][0]['components']
        
        logger.info(f"Live AQI data retrieved for {city}: AQI={predicted_aqi:.2f}")
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error getting live AQI for {city}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve live AQI data'}), 500


@app.route('/api/aqi-history', methods=['GET'])
def get_aqi_history():
    """
    Get historical AQI predictions for trend analysis
    
    Query parameters:
    - city: City name (required)
    - days: Number of days (default: 7)
    """
    try:
        city = request.args.get('city')
        days = int(request.args.get('days', 7))
        
        if not city:
            return jsonify({'error': 'City parameter is required'}), 400
        
        if days > 30:
            days = 30  # Limit to 30 days
        
        # Get weather data for the past N days
        weather_url = f"{OPENWEATHER_BASE_URL}/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
        weather_response = requests.get(weather_url)
        
        if weather_response.status_code != 200:
            return jsonify({'error': f'Failed to get weather data for {city}'}), 404
        
        weather_data = weather_response.json()
        
        # Generate historical data (simulate with slight variations)
        base_temp = weather_data['main']['temp']
        base_humidity = weather_data['main']['humidity']
        base_pressure = weather_data['main']['pressure']
        
        history_data = []
        for i in range(days):
            # Add some variation to simulate real historical data
            variation = np.random.normal(0, 2, 8)  # Small random variations
            
            temp = base_temp + variation[0]
            temp_max = weather_data['main']['temp_max'] + variation[1]
            temp_min = weather_data['main']['temp_min'] + variation[2]
            pressure = base_pressure + variation[3]
            humidity = base_humidity + variation[4]
            visibility = weather_data.get('visibility', 10000) / 1000 + variation[5]
            wind_speed = weather_data['wind']['speed'] + variation[6]
            wind_max = weather_data['wind'].get('gust', wind_speed) + variation[7]
            
            # Ensure reasonable bounds
            temp = max(-10, min(temp, 50))
            temp_max = max(temp, min(temp_max, 60))
            temp_min = max(-20, min(temp_min, temp))
            pressure = max(950, min(pressure, 1050))
            humidity = max(0, min(humidity, 100))
            visibility = max(0, visibility)
            wind_speed = max(0, wind_speed)
            wind_max = max(wind_speed, wind_max)
            
            # Predict AQI
            feature_names = ['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM']
            features_df = pd.DataFrame([[
                temp, temp_max, temp_min, pressure, humidity, visibility, wind_speed, wind_max
            ]], columns=feature_names)
            
            predicted_aqi = model.predict(features_df)[0]
            predicted_aqi = normalize_prediction(predicted_aqi)
            
            # Calculate date
            date = datetime.now() - timedelta(days=i)
            
            history_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'aqi': round(predicted_aqi, 2),
                'temperature': round(temp, 1),
                'humidity': round(humidity, 1),
                'wind_speed': round(wind_speed, 1)
            })
        
        # Sort by date (oldest first)
        history_data.reverse()
        
        return jsonify({
            'city': city,
            'history': history_data,
            'days': days
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting AQI history for {city}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve AQI history'}), 500


@app.route('/api/aqi-forecast', methods=['GET'])
def get_aqi_forecast():
    """
    Get 7-day AQI forecast for a city using the current weather as a baseline.
    
    Query parameters:
    - city: City name (required)
    - days: Number of days to forecast (default: 7, max: 14)
    """
    try:
        city = request.args.get('city')
        days = int(request.args.get('days', 7))
        
        if not city:
            return jsonify({'error': 'City parameter is required'}), 400
        
        if days > 14:
            days = 14
        
        # Use current weather as baseline for forecast
        weather_url = f"{OPENWEATHER_BASE_URL}/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
        weather_response = requests.get(weather_url)
        
        if weather_response.status_code != 200:
            return jsonify({'error': f'Failed to get weather data for {city}'}), 404
        
        weather_data = weather_response.json()
        
        base_temp = weather_data['main']['temp']
        base_humidity = weather_data['main']['humidity']
        base_pressure = weather_data['main']['pressure']
        
        forecast_data = []
        for i in range(1, days + 1):
            # Small random variations to simulate changing conditions
            variation = np.random.normal(0, 2, 8)
            
            temp = base_temp + variation[0]
            temp_max = weather_data['main']['temp_max'] + variation[1]
            temp_min = weather_data['main']['temp_min'] + variation[2]
            pressure = base_pressure + variation[3]
            humidity = base_humidity + variation[4]
            visibility = weather_data.get('visibility', 10000) / 1000 + variation[5]
            wind_speed = weather_data['wind']['speed'] + variation[6]
            wind_max = weather_data['wind'].get('gust', wind_speed) + variation[7]
            
            # Clamp to reasonable meteorological bounds
            temp = max(-10, min(temp, 50))
            temp_max = max(temp, min(temp_max, 60))
            temp_min = max(-20, min(temp_min, temp))
            pressure = max(950, min(pressure, 1050))
            humidity = max(0, min(humidity, 100))
            visibility = max(0, visibility)
            wind_speed = max(0, wind_speed)
            wind_max = max(wind_speed, wind_max)
            
            feature_names = ['T', 'TM', 'Tm', 'SLP', 'H', 'VV', 'V', 'VM']
            features_df = pd.DataFrame([[
                temp, temp_max, temp_min, pressure, humidity, visibility, wind_speed, wind_max
            ]], columns=feature_names)
            
            predicted_aqi = model.predict(features_df)[0]
            predicted_aqi = normalize_prediction(predicted_aqi)
            
            date = datetime.now() + timedelta(days=i)
            
            forecast_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'aqi': round(predicted_aqi, 2),
                'temperature': round(temp, 1),
                'humidity': round(humidity, 1),
                'wind_speed': round(wind_speed, 1)
            })
        
        return jsonify({
            'city': city,
            'forecast': forecast_data,
            'days': days
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting AQI forecast for {city}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve AQI forecast'}), 500


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    # For production, use a proper WSGI server (gunicorn, waitress, etc.)
    # For development, Flask's built-in server is fine
    app.run(debug=True, host='0.0.0.0', port=5000)
