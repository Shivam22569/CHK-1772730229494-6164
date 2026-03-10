#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ================= SENSOR CONFIG =================
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ_PIN 34
#define LED_PIN 25
#define BUZZER_PIN 26

DHT dht(DHTPIN, DHTTYPE);

// ================= WIFI CONFIG =================
const char* ssid = "WIFI NAME";
const char* password = "WIFI_PASSWORD";

// ================= FLASK SERVER =================
const char* serverUrl = "http://10.180.55.213:5000/predict_sensor";

// ================= VARIABLES =================
float max_temperature = -100;
float min_temperature = 100;
int reading_count = 0;

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=== AIR QUALITY MONITORING SYSTEM ===");

  pinMode(MQ_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  dht.begin();

  // MQ SENSOR WARMUP
  Serial.println("Warming MQ sensor for 30 seconds...");
  delay(30000);

  // ================= WIFI CONNECT =================
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } 
  else {
    Serial.println("\nWiFi Connection Failed");
  }

  Serial.println("System Ready");
  delay(2000);
}

void loop() {

  // ================= READ SENSORS =================

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  int gasValue = analogRead(MQ_PIN);

  // ================= VALIDATE DHT DATA =================

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT sensor reading failed!");
    delay(3000);
    return;
  }

  if (temperature < -40 || temperature > 80) {
    Serial.println("Invalid temperature ignored");
    delay(3000);
    return;
  }

  if (humidity < 0 || humidity > 100) {
    Serial.println("Invalid humidity ignored");
    delay(3000);
    return;
  }

  // ================= NORMALIZE GAS VALUE =================

  int gasNormalized = map(gasValue, 0, 4095, 0, 1000);

  // ================= TRACK MIN/MAX =================

  if (temperature > max_temperature) max_temperature = temperature;
  if (temperature < min_temperature) min_temperature = temperature;

  reading_count++;

  // ================= SERIAL OUTPUT =================

  Serial.println("\n------ Sensor Data ------");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Gas Raw: ");
  Serial.println(gasValue);

  Serial.print("Gas Normalized: ");
  Serial.println(gasNormalized);

  // ================= SEND DATA TO FLASK =================

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("\nSending data to Flask server...");

    StaticJsonDocument<256> doc;

    doc["temperature"] = temperature;
    doc["temp_max"] = max_temperature;
    doc["temp_min"] = min_temperature;
    doc["humidity"] = humidity;
    doc["mq_value"] = gasNormalized;

    doc["pressure"] = 1013.25;
    doc["visibility"] = 10.0;
    doc["wind_speed"] = 0.0;
    doc["wind_max"] = 0.0;

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.println("JSON Sent:");
    Serial.println(jsonString);

    HTTPClient http;

    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {

      String response = http.getString();

      Serial.println("\nServer Response:");
      Serial.println(response);

      StaticJsonDocument<200> responseDoc;

      DeserializationError error = deserializeJson(responseDoc, response);

      if (!error) {

        bool success = responseDoc["success"];

        if (success) {

          float aqi = responseDoc["aqi"];

          Serial.print("\nPredicted AQI: ");
          Serial.println(aqi);

          controlAirQuality(aqi);

        } 
        else {

          Serial.println("Prediction failed. Using local threshold.");
          localAirCheck(gasNormalized);

        }

      } 
      else {

        Serial.println("JSON parsing failed.");
        localAirCheck(gasNormalized);

      }

    } 
    else {

      Serial.print("HTTP Error: ");
      Serial.println(httpResponseCode);

      localAirCheck(gasNormalized);

    }

    http.end();

  } 
  else {

    Serial.println("WiFi not connected.");
    localAirCheck(gasNormalized);

  }

  Serial.println("-----------------------------");

  delay(5000);
}


// ================= ML CONTROL =================

void controlAirQuality(float aqi) {

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.print("Air Quality Status: ");

  if (aqi <= 50) {

    Serial.println("GOOD");

  } 
  else if (aqi <= 100) {

    digitalWrite(LED_PIN, HIGH);
    Serial.println("MODERATE");

  } 
  else {

    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);

    Serial.println("POOR");

  }

}


// ================= LOCAL FALLBACK =================

void localAirCheck(int gasValue) {

  if (gasValue > 600) {

    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);

    Serial.println("Air Quality POOR (Local)");

  } 
  else {

    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    Serial.println("Air Quality GOOD (Local)");

  }

}
