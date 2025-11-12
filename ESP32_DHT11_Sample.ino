/*
 * ESP32 + DHT11 Temperature Sensor for Predictive Maintenance System
 * 
 * This Arduino sketch reads temperature from DHT11 sensor and sends it
 * to the backend API endpoint for machine monitoring.
 * 
 * Hardware Required:
 * - ESP32 board
 * - DHT11 temperature sensor
 * - Connecting wires
 * 
 * Wiring:
 * - DHT11 VCC -> ESP32 3.3V
 * - DHT11 GND -> ESP32 GND
 * - DHT11 DATA -> ESP32 GPIO 4 (configurable)
 * 
 * Libraries Required:
 * - WiFi (built-in)
 * - HTTPClient (built-in)
 * - DHT sensor library by Adafruit
 * - Adafruit Unified Sensor
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API configuration
const char* serverUrl = "https://smart-maintenance-11.preview.emergentagent.com/api/ingest-temperature";
const char* apiKey = "esp32_secure_key_123";  // Match with backend ESP32_API_KEY

// Machine configuration
const char* machineType = "CNC";  // Options: CNC, EDM, Lathe, Grinding

// DHT11 sensor configuration
#define DHTPIN 4          // GPIO pin connected to DHT11 DATA
#define DHTTYPE DHT11     // DHT11 sensor type
DHT dht(DHTPIN, DHTTYPE);

// Timing configuration
const unsigned long SEND_INTERVAL = 30000;  // Send data every 30 seconds
unsigned long lastSendTime = 0;

// WiFi reconnect settings
const int MAX_WIFI_RETRIES = 5;
const unsigned long WIFI_RETRY_DELAY = 5000;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n==================================");
  Serial.println("ESP32 Predictive Maintenance System");
  Serial.println("Temperature Monitoring with DHT11");
  Serial.println("==================================");
  
  // Initialize DHT sensor
  dht.begin();
  Serial.println("DHT11 sensor initialized");
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("\nSetup complete. Starting monitoring...");
  Serial.println("----------------------------------");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    connectToWiFi();
  }
  
  // Send temperature data at specified interval
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentTime;
    
    // Read temperature from DHT11
    float temperature = dht.readTemperature();
    
    // Check if reading is valid
    if (isnan(temperature)) {
      Serial.println("Error: Failed to read from DHT11 sensor!");
      return;
    }
    
    // Display reading
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");
    
    // Send to backend
    sendTemperature(temperature);
  }
  
  delay(1000);  // Small delay to prevent overwhelming the loop
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < MAX_WIFI_RETRIES) {
    delay(WIFI_RETRY_DELAY);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\nFailed to connect to WiFi!");
    Serial.println("Please check credentials and try again.");
  }
}

void sendTemperature(float temperature) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot send data: WiFi not connected");
    return;
  }
  
  HTTPClient http;
  
  Serial.println("Sending data to server...");
  
  // Begin HTTP POST
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  String payload = "{";
  payload += "\"api_key\":\"" + String(apiKey) + "\",";
  payload += "\"machine_type\":\"" + String(machineType) + "\",";
  payload += "\"temperature\":" + String(temperature, 2);
  payload += "}";
  
  Serial.print("Payload: ");
  Serial.println(payload);
  
  // Send POST request
  int httpResponseCode = http.POST(payload);
  
  // Check response
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Response code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response: ");
    Serial.println(response);
    
    if (httpResponseCode == 200) {
      Serial.println("✓ Data sent successfully!");
    } else {
      Serial.println("⚠ Server returned non-200 status");
    }
  } else {
    Serial.print("✗ HTTP Error: ");
    Serial.println(httpResponseCode);
    Serial.println(http.errorToString(httpResponseCode));
  }
  
  http.end();
  Serial.println("----------------------------------");
}

/*
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Install Arduino IDE from https://www.arduino.cc/en/software
 * 
 * 2. Install ESP32 board support:
 *    - File -> Preferences
 *    - Add to "Additional Board Manager URLs":
 *      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *    - Tools -> Board -> Boards Manager
 *    - Search "ESP32" and install
 * 
 * 3. Install required libraries:
 *    - Sketch -> Include Library -> Manage Libraries
 *    - Search and install:
 *      a. "DHT sensor library" by Adafruit
 *      b. "Adafruit Unified Sensor"
 * 
 * 4. Configure this sketch:
 *    - Update WiFi credentials (ssid, password)
 *    - Update serverUrl if different
 *    - Update apiKey to match backend configuration
 *    - Set machineType (CNC, EDM, Lathe, or Grinding)
 * 
 * 5. Upload to ESP32:
 *    - Tools -> Board -> ESP32 Dev Module (or your specific board)
 *    - Tools -> Port -> Select your ESP32 port
 *    - Click Upload button
 * 
 * 6. Monitor serial output:
 *    - Tools -> Serial Monitor
 *    - Set baud rate to 115200
 * 
 * TROUBLESHOOTING:
 * 
 * - If temperature reads NaN: Check DHT11 wiring and connections
 * - If WiFi won't connect: Verify SSID and password
 * - If HTTP fails: Check server URL and network connectivity
 * - If 401 error: Verify API key matches backend configuration
 * - If 400 error: Check machine_type is valid (CNC/EDM/Lathe/Grinding)
 */
