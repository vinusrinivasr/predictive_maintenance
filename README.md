# Predictive Maintenance System using AI

A production-ready full-stack web application for monitoring machine health and predicting maintenance needs using rule-based AI and IoT sensors.

## 🎯 Features

- **Real-time Temperature Monitoring**: ESP32 + DHT11 sensor integration
- **Machine Analysis Dashboard**: CNC, EDM, Lathe, and Grinding machines
- **Risk Prediction**: Rule-based AI with weighted scoring (0-100)
- **Historical Tracking**: Complete history with filtering and CSV export
- **Trend Visualization**: Chart.js powered analytics
- **Role-Based Access**: Operator, Engineer, and Manager roles
- **JWT Authentication**: Secure user management

## 🚀 Quick Start

### 1. Register Account
Visit the app and create an account with your role (Operator/Engineer/Manager)

### 2. Dashboard
- Select machine type (CNC/EDM/Lathe/Grinding)
- Enter manual metrics: running hours, feed rate, vibration, maintenance date
- Temperature auto-fills from ESP32 sensor (or manual override)
- Click "Analyze Performance" for instant health assessment

### 3. ESP32 Setup (Optional)
Upload `ESP32_DHT11_Sample.ino` to your ESP32 with DHT11 sensor to enable automatic temperature monitoring.

### 4. View Results
- **Condition Level**: Good (Green), Medium (Yellow), or Critical (Red)
- **Risk Score**: 0-100 with detailed explanation
- **Alerts**: Actionable maintenance recommendations

## 📊 Screens

1. **Dashboard**: Real-time analysis with manual inputs
2. **History**: View all predictions with filters and CSV export
3. **Trends**: Chart.js visualizations of risk scores over time
4. **Settings**: Configure thresholds and sensor modes (Manager only)

## 🔧 Technical Stack

- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Chart.js
- **Backend**: FastAPI, JWT auth, MongoDB
- **IoT**: ESP32 + DHT11 temperature sensor

## 📡 API Key for ESP32

Get API key from Settings page and configure in ESP32 sketch for temperature ingestion.

## 🎨 Design

Modern UI with gradient backgrounds, glass-morphism effects, and responsive layout. Color-coded condition levels for instant recognition.

---

For detailed documentation, see full README in project root.
