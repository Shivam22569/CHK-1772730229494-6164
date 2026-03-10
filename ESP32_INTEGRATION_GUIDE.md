# 🚀 ESP32 Air Quality Monitoring - Complete Integration Guide

## 📋 Overview
This guide will help you integrate your ESP32 air quality monitoring system with machine learning predictions. You'll upgrade from local sensor readings to intelligent AQI predictions using your trained Random Forest model.

---

## 🛠️ Step 1: Hardware Setup

### Components You Need
- ✅ ESP32 development board (you already have)
- ✅ DHT22 sensor (you already have)
- ✅ MQ sensor (you already have)
- ✅ LED (you already have)
- ✅ Buzzer (you already have)
- ✅ Jumper wires
- ✅ USB cable for ESP32

### Wiring Connections (Same as Your Current Setup)
```
ESP32          DHT22
3.3V  --------> VCC
GND   --------> GND
GPIO 4 --------> DATA

ESP32          MQ Sensor
3.3V  --------> VCC
GND   --------> GND
GPIO 34 -------> A0 (Analog Output)

ESP32          LED
GPIO 25 -------> + (Anode) with 220Ω resistor
GND   ---------> - (Cathode)

ESP32          Buzzer
GPIO 26 -------> + with 220Ω resistor
GND   ---------> -
```

---

## 💻 Step 2: Software Installation

### 2.1 Install Arduino IDE
1. Go to: https://www.arduino.cc/en/software
2. Download Arduino IDE (Windows version)
3. Install it on your computer

### 2.2 Add ESP32 Support to Arduino IDE
1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for "esp32"
7. Install "esp32 by Espressif Systems"

### 2.3 Install Required Libraries
1. In Arduino IDE, go to **Sketch → Include Library → Manage Libraries**
2. Search and install:
   - **DHT sensor library** by Adafruit
   - **ArduinoJson** by Benoit Blanchon

---

## 🔧 Step 3: Code Configuration

### 3.1 Open the New Code File
1. Open `new_esp32_code.ino` in Arduino IDE
2. You should see the code with your sensor setup

### 3.2 Update WiFi Settings
**Find these lines (around line 12-13):**
```cpp
const char* ssid = "YOUR_WIFI_NAME";        // Replace with your WiFi network name
const char* password = "YOUR_WIFI_PASSWORD"; // Replace with your WiFi password
```

**Change to your WiFi details:**
```cpp
const char* ssid = "MyHomeWiFi";           // Your actual WiFi name
const char* password = "MyWiFiPassword123"; // Your actual WiFi password
```

### 3.3 Find Your Computer's IP Address
1. On your computer, open **Command Prompt** (Windows key + R, type "cmd", press Enter)
2. Type: `ipconfig`
3. Look for "IPv4 Address" - it will look like: `192.168.1.100`
4. Copy this IP address

### 3.4 Update Flask Server IP
**Find this line (around line 16):**
```cpp
const char* serverUrl = "http://192.168.X.X:5000/predict_sensor";
```

**Replace with your actual IP:**
```cpp
const char* serverUrl = "http://192.168.1.100:5000/predict_sensor";
// Replace 192.168.1.100 with the IP you found in step 3.3
```

---

## 🖥️ Step 4: Flask Server Setup

### 4.1 Install Python Dependencies
1. Open Command Prompt on your computer
2. Navigate to your project folder:
   ```cmd
   cd "C:\Users\admin\OneDrive\Desktop\sveri\Air-Quality-Prediction-main\Air-Quality-Prediction-main"
   ```
3. Install required packages:
   ```cmd
   pip install Flask numpy scikit-learn flask-cors
   ```

### 4.2 Start Flask Server
1. In the same Command Prompt, run:
   ```cmd
   python app.py
   ```
2. You should see:
   ```
   * Running on http://0.0.0.0:5000/ (Press CTRL+C to quit)
   ```
3. **Keep this window open** - the Flask server must be running

---

## 📤 Step 5: Upload Code to ESP32

### 5.1 Select ESP32 Board
1. In Arduino IDE, go to **Tools → Board**
2. Select **"ESP32 Dev Module"**

### 5.2 Select COM Port
1. Go to **Tools → Port**
2. Select the COM port where your ESP32 is connected
   - If you don't see any ports, make sure ESP32 is connected via USB

### 5.3 Upload Code
1. Click the **Upload** button (right arrow icon) in Arduino IDE
2. Wait for upload to complete (you'll see "Done uploading" in the status bar)
3. **Do not close Arduino IDE yet**

---

## 🔍 Step 6: Testing & Monitoring

### 6.1 Open Serial Monitor
1. In Arduino IDE, go to **Tools → Serial Monitor**
2. Set baud rate to **115200** (bottom right corner)
3. You should see output like:
   ```
   === AIR QUALITY MONITORING SYSTEM ===
   Upgraded with WiFi + ML Prediction

   Connecting to WiFi...
   .....
   ✅ WiFi Connected!
   📡 IP Address: 192.168.1.100

   === System Ready ===
   ```

### 6.2 Check Sensor Readings
After a few seconds, you should see:
```
------ Sensor Data ------
🌡️ Temperature: 25.50 °C
💧 Humidity: 60.00 %
💨 Gas Value: 1456

📤 Sending data to Flask server...
📊 JSON Data:
{"temperature":25.5,"temp_max":25.5,"temp_min":25.5,"humidity":60,"mq_value":1456,"pressure":1013.25,"visibility":10,"wind_speed":0,"wind_max":0}

📥 Server Response:
{"success":true,"air_quality_index":45.67}

🤖 ML Prediction - AQI: 45.67
🎯 Air Quality Status: GOOD ✅
-------------------------
```

### 6.3 Test LED & Buzzer Response
- **AQI ≤ 50**: LED OFF, Buzzer OFF (Good air)
- **AQI ≤ 100**: LED ON, Buzzer OFF (Moderate air)
- **AQI > 100**: LED ON, Buzzer ON (Poor air)

---

## 🔧 Step 7: Troubleshooting

### Issue: "WiFi Connection Failed"
**Solutions:**
1. Check WiFi name and password in code
2. Make sure you're in WiFi range
3. Try different WiFi network
4. Restart ESP32 and try again

### Issue: "HTTP Error: -1" or other HTTP errors
**Solutions:**
1. Check if Flask server is running (`python app.py`)
2. Verify IP address in ESP32 code matches your computer
3. Check firewall - allow port 5000
4. Try restarting Flask server

### Issue: "Failed to read temperature from DHT22"
**Solutions:**
1. Check DHT22 wiring (GPIO 4)
2. Add 10kΩ resistor between VCC and Data pin
3. Try different GPIO pin if needed

### Issue: MQ sensor shows strange values
**Solutions:**
1. Let sensor warm up for 2-3 minutes
2. Check MQ sensor wiring (GPIO 34)
3. Verify 3.3V power supply
4. Clean sensor surface if dusty

### Issue: LED/Buzzer not working
**Solutions:**
1. Check resistor values (220Ω)
2. Verify wiring polarity
3. Test with simple blink sketch first
4. Check GPIO pins (25 for LED, 26 for Buzzer)

---

## 📊 Understanding the Output

### Serial Monitor Output Explained
```
------ Sensor Data ------          ← Your original sensor readings
🌡️ Temperature: 25.50 °C          ← DHT22 temperature
💧 Humidity: 60.00 %               ← DHT22 humidity
💨 Gas Value: 1456                 ← MQ sensor raw value

📤 Sending data to Flask server... ← New: Sending to ML model
📊 JSON Data: {...}                ← Data being sent
📥 Server Response: {...}          ← ML model response
🤖 ML Prediction - AQI: 45.67      ← AQI from your trained model
🎯 Air Quality Status: GOOD ✅      ← LED/Buzzer control
```

### AQI Classification
- **AQI 0-50**: GOOD ✅ (LED OFF, Buzzer OFF)
- **AQI 51-100**: MODERATE ⚠️ (LED ON, Buzzer OFF)
- **AQI 101+**: POOR 🚨 (LED ON, Buzzer ON)

---

## 🎯 What Changed from Your Original Code

### ✅ What Stayed the Same
- DHT22 sensor reading (temperature & humidity)
- MQ sensor reading (gas value)
- LED control (GPIO 25)
- Buzzer control (GPIO 26)
- Serial output format
- 2-second delay (changed to 5 seconds for WiFi)

### 🆕 What Was Added
- WiFi connectivity
- HTTP communication with Flask server
- JSON data formatting
- ML model prediction integration
- Intelligent AQI-based LED/Buzzer control
- Error handling and fallback to local threshold
- Temperature min/max tracking

---

## 🚀 Advanced Features (Optional)

### Add More LEDs for Better Indication
```cpp
#define GREEN_LED_PIN 25   // Good air quality
#define YELLOW_LED_PIN 26  // Moderate air quality
#define RED_LED_PIN 27     // Poor air quality
```

### Add LCD Display
```cpp
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
```

### Send Data to Cloud
```cpp
// Add to loop()
sendToThingSpeak(temperature, humidity, aqi);
```

---

## 📞 Support

If you get stuck:
1. Check the troubleshooting section above
2. Verify all wiring connections
3. Make sure Flask server is running
4. Check Serial Monitor for error messages
5. Try the fallback local threshold mode

---

## ✅ Success Checklist

- [ ] Arduino IDE installed with ESP32 support
- [ ] Required libraries installed (DHT, ArduinoJson)
- [ ] WiFi credentials updated in code
- [ ] Computer IP address updated in code
- [ ] Hardware wired correctly
- [ ] Flask server running on computer
- [ ] Code uploaded to ESP32 successfully
- [ ] Serial Monitor shows sensor readings
- [ ] Serial Monitor shows ML predictions
- [ ] LED and Buzzer respond to AQI levels

**Congratulations! 🎉 You now have an intelligent air quality monitoring system with machine learning predictions!**

---

*Last Updated: March 10, 2026*