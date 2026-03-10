/*
 * ========================================================================
 * AI Air Quality Monitoring System - Frontend JavaScript
 * ========================================================================
 * Handles form input, API communication, and data visualization
 * ========================================================================
 */

// ========================================================================
// GLOBAL STATE
// ========================================================================

const appState = {
    predictions: [],
    currentPrediction: null,
    weatherData: [],
};

// Chart instances
let aqiTrendChart = null;
let weatherChart = null;
let pollutionChart = null;
let categoryChart = null;

// ========================================================================
// INITIALIZATION
// ========================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    
    // Check server health first
    checkServerHealth();
    
    // Attach event listeners
    setupEventListeners();
    
    // Initialize charts with sample data
    initializeCharts();
    
    // Load sample data on first load
    const firstVisit = !localStorage.getItem('hasVisited');
    if (firstVisit) {
        loadSampleData();
        localStorage.setItem('hasVisited', 'true');
    }
});

// ========================================================================
// EVENT LISTENERS
// ========================================================================

/**
 * Check if Flask server is running and respond with helpful message
 */
function checkServerHealth() {
    fetch('/api/health', { method: 'GET' })
        .then(response => {
            if (response.ok) {
                console.log('Server health check passed');
                updateServerStatus(true);
            } else {
                console.warn('Server returned error status:', response.status);
                updateServerStatus(false);
            }
        })
        .catch(error => {
            console.error('Server health check failed:', error);
            updateServerStatus(false);
            
            // Show a helpful message to the user
            const statusBadge = document.getElementById('statusBadge');
            if (statusBadge) {
                statusBadge.innerHTML = '<span class="status-dot" style="background-color: #ff6b6b;"></span> Flask server not found';
                statusBadge.style.borderColor = '#ff6b6b';
                statusBadge.style.color = '#ff6b6b';
            }
        });
}

/**
 * Update the server status badge
 */
function updateServerStatus(isHealthy) {
    const statusBadge = document.getElementById('server-status');
    if (!statusBadge) return;
    
    if (isHealthy) {
        statusBadge.style.color = 'var(--aqi-good)';
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> System Active';
        console.log('✓ Server is running and ready');
    } else {
        statusBadge.style.color = 'var(--danger)';
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> Server Offline';
        showMessage('error', '⚠️ Flask server is not running.');
    }
}

function setupEventListeners() {
    const predictBtn = document.getElementById('predictBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sampleDataBtn = document.getElementById('sampleDataBtn');
    const form = document.getElementById('predictionForm');

    predictBtn.addEventListener('click', handlePredict);
    clearBtn.addEventListener('click', clearForm);
    sampleDataBtn.addEventListener('click', loadSampleData);
    
    // Allow Enter key to trigger prediction
    form.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            handlePredict();
        }
    });
}

// ========================================================================
// FORM HANDLING
// ========================================================================

/**
 * Collect form data and send to API for prediction
 */
async function handlePredict() {
    console.log('Predict button clicked');
    
    // Get form data
    const formData = getFormData();
    
    // Validate form data
    if (!validateFormData(formData)) {
        showMessage('error', 'Please fill in all fields with valid values');
        return;
    }
    
    // Show loading indicator
    showLoading(true);
    
    try {
        // Send prediction request to API
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            timeout: 10000  // 10 second timeout
        });
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update UI with prediction
            updatePredictionDisplay(data);
            
            // Store prediction in state
            appState.currentPrediction = data;
            appState.predictions.push({
                ...data,
                timestamp: new Date(),
                input: formData
            });
            
            // Update charts
            updateCharts();
            
            // Show success message
            showMessage('success', `Prediction successful! AQI: ${data.aqi}`);
            
            // Generate alerts if needed
            generateAlerts(data);
        } else {
            // Server returned an error in the response
            showMessage('error', data.error || 'Prediction failed');
        }
    } catch (error) {
        console.error('Prediction Error:', error);
        
        // Provide helpful error messages based on error type
        let errorMsg = 'Network error. ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMsg += 'Flask server may not be running. Make sure to: 1) Run "python app.py" in terminal 2) Check that http://localhost:5000 loads in your browser';
        } else if (error.message.includes('timeout')) {
            errorMsg += 'Request took too long. Server may be overloaded.';
        } else if (error.message.includes('Server returned')) {
            errorMsg += error.message;
        } else {
            errorMsg += 'Please check that the Flask server is running.';
        }
        
        showMessage('error', errorMsg);
        logEvent('prediction_error', { error: error.message });
    } finally {
        showLoading(false);
    }
}

/**
 * Extract form data into an object
 */
function getFormData() {
    return {
        T: parseFloat(document.getElementById('tempInput').value),
        TM: parseFloat(document.getElementById('maxTempInput').value),
        Tm: parseFloat(document.getElementById('minTempInput').value),
        SLP: parseFloat(document.getElementById('pressureInput').value),
        H: parseFloat(document.getElementById('humidityInput').value),
        VV: parseFloat(document.getElementById('visibilityInput').value),
        V: parseFloat(document.getElementById('windInput').value),
        VM: parseFloat(document.getElementById('maxWindInput').value)
    };
}

/**
 * Validate form data
 */
function validateFormData(data) {
    // Check all fields are present and are numbers
    for (let key in data) {
        if (isNaN(data[key]) || data[key] === null || data[key] === '') {
            return false;
        }
    }
    
    // Validate ranges
    if (data.H < 0 || data.H > 100) {
        console.warn('Humidity should be between 0 and 100');
    }
    
    return true;
}

/**
 * Clear form inputs
 */
function clearForm() {
    document.getElementById('predictionForm').reset();
    document.getElementById('formMessage').style.display = 'none';
}

/**
 * Load sample data into form
 */
function loadSampleData() {
    const sampleData = {
        T: 25.5,
        TM: 32.4,
        Tm: 18.2,
        SLP: 1013.25,
        H: 65,
        VV: 10.5,
        V: 3.2,
        VM: 8.5
    };
    
    document.getElementById('tempInput').value = sampleData.T;
    document.getElementById('maxTempInput').value = sampleData.TM;
    document.getElementById('minTempInput').value = sampleData.Tm;
    document.getElementById('pressureInput').value = sampleData.SLP;
    document.getElementById('humidityInput').value = sampleData.H;
    document.getElementById('visibilityInput').value = sampleData.VV;
    document.getElementById('windInput').value = sampleData.V;
    document.getElementById('maxWindInput').value = sampleData.VM;
    
    showMessage('success', 'Sample data loaded. Click "Predict AQI" to see results.');
}

// ========================================================================
// PREDICTION DISPLAY
// ========================================================================

/**
 * Update the AQI display card with prediction results
 */
function updatePredictionDisplay(prediction) {
    const aqi = prediction.aqi;
    const category = prediction.category;
    const color = prediction.color;
    const emoji = prediction.emoji;
    const message = prediction.message;
    
    // Update circle and values
    const circleEl = document.getElementById('aqiCircle');
    circleEl.style.borderColor = color;
    
    const valueEl = document.getElementById('aqiValue');
    valueEl.textContent = Math.round(aqi);
    valueEl.style.color = color;
    
    // Update category info
    const categoryEl = document.getElementById('aqiCategory');
    categoryEl.textContent = category;
    categoryEl.style.color = color;
    
    const messageEl = document.getElementById('aqiMessage');
    messageEl.textContent = message;
    
    const emojiEl = document.getElementById('aqiEmoji');
    emojiEl.textContent = emoji;
    
    // Add animation
    circleEl.style.animation = 'none';
    setTimeout(() => {
        circleEl.style.animation = 'pulse 2s ease-in-out';
    }, 10);
}

/**
 * Display toast message
 */
function showMessage(type, text) {
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = text;
    messageEl.className = `form-message ${type}`;
    messageEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    const overlayEl = document.getElementById('loadingOverlay');
    overlayEl.style.display = show ? 'flex' : 'none';
}

// ========================================================================
// ALERTS
// ========================================================================

/**
 * Generate health alerts based on AQI level
 */
function generateAlerts(prediction) {
    const alertsSection = document.getElementById('alertsSection');
    const alertsList = document.getElementById('alertsList');
    
    alertsList.innerHTML = ''; // Clear previous alerts
    
    const alerts = [];
    
    if (prediction.level >= 3) {
        if (prediction.level === 3) {
            alerts.push({
                icon: 'fa-info-circle',
                title: 'Sensitive Groups Alert',
                message: 'Children, elderly, and people with respiratory conditions should limit outdoor activities.'
            });
        } else if (prediction.level === 4) {
            alerts.push({
                icon: 'fa-exclamation-circle',
                title: 'Moderate Health Risk',
                message: 'Everyone should reduce intense outdoor activities. Consider wearing N95 masks.'
            });
        } else if (prediction.level >= 5) {
            alerts.push({
                icon: 'fa-exclamation-triangle',
                title: 'SEVERE HEALTH WARNING',
                message: 'Avoid all outdoor activities. Stay indoors with air purifiers if possible.'
            });
            alerts.push({
                icon: 'fa-phone',
                title: 'Emergency Contact',
                message: 'If experiencing respiratory difficulty, call emergency services immediately.'
            });
        }
    }
    
    if (alerts.length > 0) {
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item">
                <span class="alert-icon"><i class="fas ${alert.icon}"></i></span>
                <div>
                    <strong>${alert.title}</strong>
                    <p>${alert.message}</p>
                </div>
            </div>
        `).join('');
        
        alertsSection.style.display = 'block';
    } else {
        alertsSection.style.display = 'none';
    }
}

// ========================================================================
// CHARTS
// ========================================================================

/**
 * Initialize Chart.js instances
 */
function initializeCharts() {
    initializeAQITrendChart();
    initializeWeatherChart();
    initializePollutionChart();
    initializeCategoryChart();
}

/**
 * Initialize AQI Trend Chart
 */
function initializeAQITrendChart() {
    const ctx = document.getElementById('aqiTrendChart').getContext('2d');
    aqiTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'AQI Level',
                data: [],
                borderColor: '#1e88e5',
                backgroundColor: 'rgba(30, 136, 229, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#1e88e5',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#ffffff', font: { family: 'Outfit', size: 12 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 500,
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Outfit' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Outfit' } },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Initialize Weather Chart (Radar)
 */
function initializeWeatherChart() {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    weatherChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Temperature', 'Humidity', 'Pressure', 'Wind Speed', 'Visibility'],
            datasets: [{
                label: 'Current Conditions (Normalized)',
                data: [0, 0, 0, 0, 0],
                borderColor: '#43a047',
                backgroundColor: 'rgba(67, 160, 71, 0.2)',
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#43a047'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                }
            },
            scales: {
                r: {
                    ticks: { color: '#b0b0c0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

/**
 * Initialize Pollution Level Chart (Bar)
 */
function initializePollutionChart() {
    const ctx = document.getElementById('pollutionChart').getContext('2d');
    pollutionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Pressure', 'Humidity', 'Visibility', 'Wind Speed'],
            datasets: [{
                label: 'Pollution Levels',
                data: [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(255, 152, 0, 0.7)',
                    'rgba(244, 67, 54, 0.7)',
                    'rgba(156, 39, 176, 0.7)'
                ],
                borderColor: [
                    '#ffc107',
                    '#ff9800',
                    '#f44336',
                    '#9c27b0'
                ],
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#b0b0c0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#b0b0c0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

/**
 * Initialize Category Distribution Chart (Doughnut)
 */
function initializeCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Good', 'Moderate', 'Unhealthy', 'Very Unhealthy', 'Hazardous'],
            datasets: [{
                data: [20, 30, 25, 15, 10],
                backgroundColor: [
                    '#00B050',
                    '#FFC000',
                    '#FF9500',
                    '#FF5500',
                    '#950003'
                ],
                borderColor: '#0f3460',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff', padding: 15 }
                }
            }
        }
    });
}

/**
 * Update all charts with new data
 */
function updateCharts() {
    if (appState.currentPrediction) {
        updateAQITrendChart();
        updateWeatherChart();
        updatePollutionChart();
        updateCategoryChart();
    }
}

/**
 * Update AQI Trend Chart
 */
function updateAQITrendChart() {
    const predictions = appState.predictions.slice(-10); // Last 10 predictions
    
    aqiTrendChart.data.labels = predictions.map((p, i) => `Pred ${i + 1}`);
    aqiTrendChart.data.datasets[0].data = predictions.map(p => p.aqi);
    
    // Color code the points based on AQI level
    aqiTrendChart.data.datasets[0].pointBackgroundColor = predictions.map(p => {
        if (p.aqi <= 50) return '#00B050';
        if (p.aqi <= 100) return '#FFC000';
        if (p.aqi <= 150) return '#FF9500';
        if (p.aqi <= 200) return '#FF5500';
        if (p.aqi <= 300) return '#950003';
        return '#4B0082';
    });
    
    aqiTrendChart.update();
}

/**
 * Update Weather Chart with normalized data
 */
function updateWeatherChart() {
    const input = appState.currentPrediction.input;
    
    // Normalize data to 0-100 scale for better visualization
    const normalizedData = [
        (input.T + 50) % 100, // Temperature normalized
        input.H,               // Humidity (already 0-100)
        ((input.SLP - 970) / 5) % 100, // Pressure normalized
        (input.V * 10) % 100,  // Wind speed normalized
        (input.VV * 10) % 100  // Visibility normalized
    ];
    
    weatherChart.data.datasets[0].data = normalizedData;
    weatherChart.update();
}

/**
 * Update Pollution Chart
 */
function updatePollutionChart() {
    const input = appState.currentPrediction.input;
    
    pollutionChart.data.datasets[0].data = [
        (input.SLP / 10) % 100,
        input.H,
        (input.VV * 5) % 100,
        (input.V * 15) % 100
    ];
    
    pollutionChart.update();
}

/**
 * Update Category Chart
 */
function updateCategoryChart() {
    const predictions = appState.predictions;
    const categories = {
        good: 0,
        moderate: 0,
        unhealthy: 0,
        veryUnhealthy: 0,
        hazardous: 0
    };
    
    predictions.forEach(p => {
        if (p.level === 1) categories.good++;
        else if (p.level === 2) categories.moderate++;
        else if (p.level === 3) categories.unhealthy++;
        else if (p.level === 4) categories.veryUnhealthy++;
        else if (p.level >= 5) categories.hazardous++;
    });
    
    const total = predictions.length || 1;
    categoryChart.data.datasets[0].data = [
        (categories.good / total) * 100,
        (categories.moderate / total) * 100,
        (categories.unhealthy / total) * 100,
        (categories.veryUnhealthy / total) * 100,
        (categories.hazardous / total) * 100
    ];
    
    categoryChart.update();
}

// ========================================================================
// UTILITIES
// ========================================================================

/**
 * Log user interactions for analytics
 */
function logEvent(eventName, data) {
    console.log(`[Event] ${eventName}:`, data);
    // In production, send to analytics service
}

/**
 * Get AQI category from value
 */
function getAQICategory(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

// ========================================================================
// EXPORT & DEBUG
// ========================================================================

// Make functions available in console for debugging
window.appDebug = {
    state: appState,
    getPredictions: () => appState.predictions,
    clearPredictions: () => { appState.predictions = []; },
    loadSampleData: loadSampleData
};

console.log('App ready. Type `appDebug` in console for debugging tools.');
