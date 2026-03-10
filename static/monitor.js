// ============================================================================
// Live AQI Monitor - Frontend JavaScript
// ============================================================================
// Handles city selection, live AQI monitoring, and data visualization
// ============================================================================

// Global state management
const monitorState = {
    currentCity: null,
    currentData: null,
    historyData: null,
    charts: {
        trendChart: null,
        pollutionChart: null,
        fullTrendChart: null
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    document.getElementById('error-text').textContent = message;
    errorDiv.style.display = 'flex';
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function showSection(sectionId) {
    document.getElementById(sectionId).style.display = 'block';
}

function hideSection(sectionId) {
    document.getElementById(sectionId).style.display = 'none';
}

function updateAQIDisplay(data) {
    const aqiValue = document.getElementById('aqi-value');
    const aqiCategory = document.getElementById('aqi-category');
    const aqiMessage = document.getElementById('aqi-message');
    const aqiCircle = document.getElementById('aqi-circle');
    const aqiTimestamp = document.getElementById('aqi-timestamp');

    aqiValue.textContent = data.aqi_prediction.value;
    aqiCategory.textContent = data.aqi_prediction.category;
    aqiMessage.textContent = data.aqi_prediction.message;
    aqiTimestamp.textContent = `Last updated: ${new Date().toLocaleString()}`;

    // Update circle color
    aqiCircle.style.borderColor = data.aqi_prediction.color;
    aqiValue.style.color = data.aqi_prediction.color;
}

function updateWeatherDisplay(data) {
    document.getElementById('temp').textContent = `${data.weather.temperature}°C`;
    document.getElementById('temp-range').textContent = `Min: ${data.weather.temp_min}°C, Max: ${data.weather.temp_max}°C`;
    document.getElementById('humidity').textContent = `${data.weather.humidity}%`;
    document.getElementById('wind-speed').textContent = `${data.weather.wind_speed} m/s`;
    document.getElementById('wind-range').textContent = `Gust: ${data.weather.wind_max} m/s`;
    document.getElementById('visibility').textContent = `${data.weather.visibility} km`;
    document.getElementById('pressure').textContent = `${data.weather.pressure} hPa`;
    document.getElementById('weather-desc').textContent = data.weather.description;
}

function updateCityInfo(data) {
    document.getElementById('city-title').textContent = `${data.city}, ${data.country}`;
    document.getElementById('country-info').textContent = data.country;
    document.getElementById('coordinates').textContent =
        `${data.coordinates.lat.toFixed(2)}°, ${data.coordinates.lon.toFixed(2)}°`;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchLiveAQI(city) {
    try {
        const response = await fetch(`/api/live-aqi?city=${encodeURIComponent(city)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching live AQI:', error);
        throw error;
    }
}

async function fetchAQIHistory(city, days = 7) {
    try {
        const response = await fetch(`/api/aqi-history?city=${encodeURIComponent(city)}&days=${days}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching AQI history:', error);
        throw error;
    }
}

async function fetchAQIForecast(city, days = 7) {
    try {
        const response = await fetch(`/api/aqi-forecast?city=${encodeURIComponent(city)}&days=${days}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching AQI forecast:', error);
        throw error;
    }
}

// ============================================================================
// CHART FUNCTIONS
// ============================================================================

function createAQITrendChart(historyData) {
    const ctx = document.getElementById('aqi-trend-chart').getContext('2d');

    // Destroy existing chart if it exists
    if (monitorState.charts.trendChart) {
        monitorState.charts.trendChart.destroy();
    }

    const labels = historyData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const aqiValues = historyData.map(item => item.aqi);

    monitorState.charts.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'AQI Value',
                data: aqiValues,
                borderColor: '#1e88e5',
                backgroundColor: 'rgba(30, 136, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#1e88e5',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#ffffff', font: { family: 'Outfit' } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 500,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Outfit' } }
                }
            }
        }
    });
}

function createPollutionChart(pollutionData) {
    const ctx = document.getElementById('pollution-chart').getContext('2d');

    // Destroy existing chart if it exists
    if (monitorState.charts.pollutionChart) {
        monitorState.charts.pollutionChart.destroy();
    }

    // Common pollutants to display
    const pollutants = ['co', 'no', 'no2', 'o3', 'so2', 'pm2_5', 'pm10', 'nh3'];
    const labels = ['CO', 'NO', 'NO₂', 'O₃', 'SO₂', 'PM2.5', 'PM10', 'NH₃'];
    const values = pollutants.map(p => pollutionData[p] || 0);

    // Colors for different pollutants
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];

    monitorState.charts.pollutionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Concentration (μg/m³)',
                data: values,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('1)', '0.8)')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.label}: ${context.parsed.y.toFixed(2)} μg/m³`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(1);
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
}

function createFullAQITrendChart(historyData, forecastData) {
    const ctx = document.getElementById('aqi-full-trend-chart').getContext('2d');

    if (monitorState.charts.fullTrendChart) {
        monitorState.charts.fullTrendChart.destroy();
    }

    const historyLabels = historyData.map(item => item.date);
    const forecastLabels = forecastData.map(item => item.date);

    const labels = [...historyLabels, ...forecastLabels];

    const pastValues = [
        ...historyData.map(item => item.aqi),
        ...new Array(forecastData.length).fill(null)
    ];

    const futureValues = [
        ...new Array(historyData.length).fill(null),
        ...forecastData.map(item => item.aqi)
    ];

    monitorState.charts.fullTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Past 30 Days',
                    data: pastValues,
                    borderColor: '#1d4ed8',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                },
                {
                    label: '7-Day Forecast',
                    data: futureValues,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.08)',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#0f172a',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const rawDate = items[0].label;
                            const date = new Date(rawDate);
                            return isNaN(date.getTime())
                                ? rawDate
                                : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        },
                        label: (ctx) => {
                            const value = ctx.parsed.y;
                            if (value == null) return '';
                            return `${ctx.dataset.label}: ${value.toFixed(1)} AQI`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 500,
                    title: {
                        display: true,
                        text: 'AQI',
                        color: '#64748b',
                        font: { family: 'Outfit', size: 11 }
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.25)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Outfit' }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#64748b',
                        font: { family: 'Outfit', size: 11 }
                    },
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Outfit' },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function loadCityData(city) {
    try {
        showLoading();
        hideError();

        // Fetch live AQI data
        const liveData = await fetchLiveAQI(city);
        monitorState.currentData = liveData;
        monitorState.currentCity = city;

        // Update UI with live data
        updateCityInfo(liveData);
        updateAQIDisplay(liveData);
        updateWeatherDisplay(liveData);

        // Show sections
        showSection('current-aqi-section');
        showSection('weather-section');
        showSection('health-section');

        // Fetch and display history data
        try {
            const historyData = await fetchAQIHistory(city, 7);
            monitorState.historyData = historyData;
            createAQITrendChart(historyData.history);
            showSection('charts-section');
        } catch (historyError) {
            console.warn('Could not load AQI history:', historyError);
            // History is optional, don't show error
        }

        // Fetch long-range history (30 days) and 7‑day forecast for full trend
        try {
            const longHistory = await fetchAQIHistory(city, 30);
            const forecast = await fetchAQIForecast(city, 7);
            createFullAQITrendChart(longHistory.history, forecast.forecast);
            showSection('aqi-trend-section');
        } catch (trendError) {
            console.warn('Could not load full AQI trend:', trendError);
        }

        // Create pollution chart if data available
        if (liveData.air_pollution) {
            createPollutionChart(liveData.air_pollution);
        }

        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error loading city data:', error);
        showError(`Failed to load data for ${city}. Please check the city name and try again.`);
    }
}

function updateHealthRecommendations(aqiLevel) {
    const respiratoryCard = document.getElementById('respiratory-advice');
    const activityCard = document.getElementById('activity-advice');
    const vulnerableCard = document.getElementById('vulnerable-advice');

    if (aqiLevel <= 50) {
        respiratoryCard.textContent = "Air quality is good. No respiratory concerns.";
        activityCard.textContent = "Perfect for outdoor activities. Enjoy fresh air!";
        vulnerableCard.textContent = "Safe for all groups including children and elderly.";
    } else if (aqiLevel <= 100) {
        respiratoryCard.textContent = "Air quality is moderate. Sensitive individuals may experience minor irritation.";
        activityCard.textContent = "Generally safe for outdoor activities, but monitor for symptoms.";
        vulnerableCard.textContent = "Children and elderly should limit prolonged outdoor exposure.";
    } else if (aqiLevel <= 150) {
        respiratoryCard.textContent = "Air quality affects sensitive groups. Possible respiratory discomfort.";
        activityCard.textContent = "Reduce outdoor activities, especially for children and elderly.";
        vulnerableCard.textContent = "Sensitive groups should avoid outdoor activities.";
    } else if (aqiLevel <= 200) {
        respiratoryCard.textContent = "Everyone may experience respiratory symptoms.";
        activityCard.textContent = "Avoid outdoor exertion. Stay indoors if possible.";
        vulnerableCard.textContent = "All vulnerable groups should remain indoors.";
    } else if (aqiLevel <= 300) {
        respiratoryCard.textContent = "Serious respiratory effects possible for everyone.";
        activityCard.textContent = "Avoid all outdoor activities. Stay indoors.";
        vulnerableCard.textContent = "Health emergency for sensitive groups. Remain indoors.";
    } else {
        respiratoryCard.textContent = "Hazardous air quality. Serious health risk for everyone.";
        activityCard.textContent = "Stay indoors. Avoid any outdoor exposure.";
        vulnerableCard.textContent = "Health emergency. All groups should remain indoors immediately.";
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
    // Check server health
    checkServerHealth();

    // City search functionality
    const searchBtn = document.getElementById('search-btn');
    const cityInput = document.getElementById('city-input');
    const retryBtn = document.getElementById('retry-btn');
    const refreshTrendBtn = document.getElementById('refresh-trend');

    // Search button click
    searchBtn.addEventListener('click', function () {
        const city = cityInput.value.trim();
        if (city) {
            loadCityData(city);
        } else {
            showError('Please enter a city name.');
        }
    });

    // Enter key in input field
    cityInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) {
                loadCityData(city);
            } else {
                showError('Please enter a city name.');
            }
        }
    });

    // Retry button
    retryBtn.addEventListener('click', function () {
        hideError();
        const city = cityInput.value.trim();
        if (city) {
            loadCityData(city);
        }
    });

    // Refresh trend chart
    refreshTrendBtn.addEventListener('click', async function () {
        if (monitorState.currentCity) {
            try {
                const historyData = await fetchAQIHistory(monitorState.currentCity);
                monitorState.historyData = historyData;
                createAQITrendChart(historyData.history);
            } catch (error) {
                console.error('Error refreshing trend chart:', error);
                showError('Failed to refresh trend data.');
            }
        }
    });

    // Update health recommendations when AQI data loads
    // This will be called from updateAQIDisplay
    const originalUpdateAQIDisplay = updateAQIDisplay;
    updateAQIDisplay = function (data) {
        originalUpdateAQIDisplay(data);
        updateHealthRecommendations(data.aqi_prediction.level);
    };
});

// ============================================================================
// SERVER HEALTH CHECK (from main script.js)
// ============================================================================

async function checkServerHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        const statusBadge = document.getElementById('server-status');
        if (response.ok && data.status === 'healthy') {
            statusBadge.innerHTML = '<i class="fas fa-circle"></i> System Ready';
            statusBadge.className = 'status-badge status-online';
        } else {
            statusBadge.innerHTML = '<i class="fas fa-circle"></i> Server Offline';
            statusBadge.className = 'status-badge status-offline';
        }
    } catch (error) {
        const statusBadge = document.getElementById('server-status');
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> Server Offline';
        statusBadge.className = 'status-badge status-offline';
    }
}