# Technical Documentation - Predictive Maintenance System

## Architecture Overview

### System Components

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   ESP32+DHT11   │────────▶│  FastAPI Backend │◀───────▶│   MongoDB   │
│  (IoT Sensor)   │  HTTP   │   (Python 3.8+)  │  Motor  │  (Database) │
└─────────────────┘         └──────────────────┘         └─────────────┘
                                      ▲
                                      │ REST API
                                      │ JWT Auth
                                      ▼
                            ┌──────────────────┐
                            │  React Frontend  │
                            │   (Port 3000)    │
                            └──────────────────┘
```

## Backend Architecture (FastAPI)

### File Structure
```
/app/backend/
├── server.py          # Main FastAPI application
├── .env              # Environment variables
└── requirements.txt  # Python dependencies
```

### API Endpoints

#### Authentication
- **POST** `/api/auth/register` - User registration
  - Body: `{email, password, full_name, role}`
  - Returns: JWT token + user object
  
- **POST** `/api/auth/login` - User login
  - Body: `{email, password}`
  - Returns: JWT token + user object
  
- **GET** `/api/auth/me` - Get current user
  - Headers: `Authorization: Bearer <token>`
  - Returns: User object

#### Temperature Ingestion (ESP32)
- **POST** `/api/ingest-temperature` - Receive temperature from ESP32
  - Body: `{api_key, machine_type, temperature}`
  - No auth required (uses API key)
  - Returns: `{ok, machine_type, temperature, updated_at}`

- **GET** `/api/latest-temperature?machine_type=<type>` - Get latest temperature
  - Requires: JWT auth
  - Returns: `{machine_type, temperature, updated_at}`

#### Prediction & Analysis
- **POST** `/api/predict` - Analyze machine and predict condition
  - Requires: JWT auth
  - Body: `{machine_type, running_hours, feeding_rate, temperature?, vibration, maintenance_date}`
  - Returns: `{condition_level, risk_score, explanation, alerts, thresholds_used}`
  - Temperature is optional (fetched from latest if not provided)

- **GET** `/api/history` - Get prediction history
  - Requires: JWT auth
  - Query params: `machine_type, from_date, to_date, limit, offset`
  - Returns: Array of prediction records

#### Configuration
- **GET** `/api/config` - Get system configuration
  - Requires: JWT auth
  - Returns: `{sensor_mode, thresholds, api_key}`

- **POST** `/api/config` - Update configuration
  - Requires: JWT auth + Manager role
  - Body: `{sensor_mode?, thresholds?, api_key?}`
  - Returns: `{ok, message}`

### Database Schema (MongoDB)

#### users
```javascript
{
  id: string,              // UUID
  email: string,           // Unique
  full_name: string,
  role: string,            // "Operator" | "Engineer" | "Manager"
  hashed_password: string, // bcrypt hashed
  created_at: string       // ISO datetime
}
```

#### predictions
```javascript
{
  id: string,              // UUID
  machine_type: string,    // "CNC" | "EDM" | "Lathe" | "Grinding"
  running_hours: number,
  feeding_rate: number,
  temperature: number,
  vibration: number,
  maintenance_date: string,
  prediction_date: string, // ISO datetime
  risk_score: number,      // 0-100
  condition_level: string, // "Good" | "Medium" | "Critical"
  explanation: string,
  alerts: string[]
}
```

#### latest_temperature
```javascript
{
  machine_type: string,    // Primary key
  temperature: number,
  updated_at: string       // ISO datetime
}
```

#### config
```javascript
{
  sensor_mode: string,     // "prototype_low_temp" | "shopfloor_high_temp"
  thresholds: object,      // See DEFAULT_THRESHOLDS in server.py
  api_key: string          // ESP32 API key
}
```

### Rule-Based AI Algorithm

#### Risk Score Calculation

1. **Per-Metric Subscore (0-100)**
   ```python
   if value <= green_threshold:
       subscore = (value / green_threshold) * 30
   elif value <= yellow_threshold:
       range_size = yellow_threshold - green_threshold
       position = value - green_threshold
       subscore = 30 + (position / range_size) * 40
   else:
       range_size = red_threshold - yellow_threshold
       position = min(value - yellow_threshold, range_size)
       subscore = 70 + (position / range_size) * 30
   ```

2. **Weighted Risk Score**
   ```python
   risk_score = (
       0.35 * temperature_subscore +
       0.35 * vibration_subscore +
       0.15 * feed_rate_subscore +
       0.15 * running_hours_subscore
   )
   ```

3. **Condition Level Determination**
   ```python
   if has_red_metric or risk_score >= 70:
       condition = "Critical"
   elif has_yellow_metric or risk_score >= 35:
       condition = "Medium"
   else:
       condition = "Good"
   ```

### Security

- **JWT Authentication**: HS256 algorithm, 24-hour expiration
- **Password Hashing**: bcrypt with auto-generated salt
- **API Key Validation**: Simple string comparison for ESP32
- **Role-Based Access**: Only Managers can update configuration
- **CORS**: Configurable via `CORS_ORIGINS` environment variable

## Frontend Architecture (React)

### File Structure
```
/app/frontend/src/
├── App.js                 # Main app with routing
├── App.css               # Global styles
├── index.js              # Entry point with Toaster
├── index.css             # Tailwind imports
├── contexts/
│   └── AuthContext.js    # Authentication context
├── pages/
│   ├── Login.js          # Login page
│   ├── Register.js       # Registration page
│   ├── Dashboard.js      # Main analysis dashboard
│   ├── History.js        # Prediction history
│   ├── Trends.js         # Chart.js visualizations
│   └── Settings.js       # Configuration (Manager only)
├── components/
│   ├── Layout.js         # Header, navigation, layout
│   └── ui/               # shadcn/ui components
└── hooks/
    └── use-toast.js      # Toast notifications
```

### State Management

#### AuthContext
```javascript
{
  user: {id, email, full_name, role} | null,
  loading: boolean,
  token: string | null,
  login: (email, password) => Promise<{success, error?}>,
  register: (email, password, full_name, role) => Promise<{success, error?}>,
  logout: () => void,
  getAuthHeader: () => {Authorization: string} | {}
}
```

### Key Features

#### Dashboard
- Machine type selector (CNC/EDM/Lathe/Grinding)
- Auto-fetch temperature with manual override
- Manual input fields with validation
- Real-time analysis with visual results
- Color-coded condition cards (Green/Yellow/Red)
- Risk score with progress bar
- Alert badges
- Detailed explanation text

#### History
- Sortable/filterable table
- Machine type filter
- Date range filters
- CSV export functionality
- Condition badges with color coding
- Pagination support

#### Trends
- Chart.js line charts
- Main risk score trend (0-100 scale)
- Mini temperature chart
- Mini vibration chart
- Machine type selector
- Future scope card for ML integration

#### Settings (Manager Only)
- Sensor mode toggle (Prototype DHT11 vs. Industrial)
- Threshold configuration by machine type
- Temperature, vibration, feed rate, running hours
- API key management
- Usage example display
- Non-manager notification

### Routing
```
/login          → Login page
/register       → Registration page
/               → Dashboard (protected)
/history        → History (protected)
/trends         → Trends (protected)
/settings       → Settings (protected)
```

### Design System

#### Colors
- Primary: Blue (#2563eb) to Indigo (#4f46e5) gradient
- Background: Light blue/indigo gradient (#f0f9ff → #eef2ff → #faf5ff)
- Success: Emerald (#10b981)
- Warning: Amber (#f59e0b)
- Error: Rose (#f43f5e)

#### Typography
- Headings: Space Grotesk (400, 500, 600, 700)
- Body: Inter (300, 400, 500, 600, 700, 800)

#### Components
- Cards: White with 80% opacity, backdrop blur
- Buttons: Gradient backgrounds, rounded, hover effects
- Inputs: Bordered, focus rings
- Badges: Color-coded by condition
- Charts: Responsive, interactive tooltips

## ESP32 Integration

### Hardware Setup
```
ESP32 Pin    →  DHT11 Pin
3.3V         →  VCC
GPIO 4       →  DATA
GND          →  GND
```

### Software Configuration
1. Install Arduino IDE
2. Add ESP32 board support
3. Install libraries: DHT sensor library, Adafruit Unified Sensor
4. Configure WiFi credentials
5. Set server URL and API key
6. Select machine type
7. Upload sketch

### Data Flow
```
DHT11 Sensor → ESP32 → WiFi → Backend API → MongoDB
                ↓
         Serial Monitor
         (Debugging)
```

### Posting Interval
- Default: 30 seconds
- Configurable via `SEND_INTERVAL` constant
- Automatic WiFi reconnection on failure

## Deployment

### Environment Variables

#### Backend (.env)
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="predictive_maintenance"
JWT_SECRET_KEY="your-secret-key-change-in-production"
ESP32_API_KEY="esp32_secure_key_123"
CORS_ORIGINS="*"
```

#### Frontend (.env)
```bash
REACT_APP_BACKEND_URL=https://smart-maintenance-11.preview.emergentagent.com
WDS_SOCKET_PORT=443
```

### Running Locally

1. **Start MongoDB**
   ```bash
   mongod --port 27017
   ```

2. **Start Backend**
   ```bash
   cd /app/backend
   python server.py
   # Runs on http://0.0.0.0:8001
   ```

3. **Start Frontend**
   ```bash
   cd /app/frontend
   yarn start
   # Runs on http://localhost:3000
   ```

### Production Considerations

1. **Security**
   - Change JWT_SECRET_KEY to strong random value
   - Use HTTPS for all connections
   - Update ESP32_API_KEY regularly
   - Enable MongoDB authentication
   - Restrict CORS_ORIGINS

2. **Database**
   - Create indexes on frequently queried fields
   - Set up backup schedules
   - Monitor disk space

3. **Backend**
   - Use Gunicorn with multiple workers
   - Set up process manager (systemd/supervisor)
   - Configure logging to files
   - Set up error monitoring (Sentry)

4. **Frontend**
   - Build production bundle: `yarn build`
   - Serve with Nginx or CDN
   - Enable gzip compression
   - Configure caching headers

## Testing

### Manual Testing Checklist

#### Authentication
- [ ] Register new user (all roles)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Token expiration handling
- [ ] Protected route access

#### Dashboard
- [ ] Select different machine types
- [ ] Auto-fetch temperature
- [ ] Manual temperature override
- [ ] Fill all fields and analyze
- [ ] Verify risk score calculation
- [ ] Check condition color coding
- [ ] Test with various input ranges

#### History
- [ ] View all predictions
- [ ] Filter by machine type
- [ ] Filter by date range
- [ ] Export to CSV
- [ ] Verify data accuracy

#### Trends
- [ ] View charts for each machine
- [ ] Verify chart data matches history
- [ ] Test machine selector
- [ ] Check mini-charts

#### Settings
- [ ] View as non-manager (read-only)
- [ ] Switch sensor modes as manager
- [ ] Update thresholds
- [ ] Change API key
- [ ] Verify changes persist

#### ESP32
- [ ] WiFi connection
- [ ] Temperature reading accuracy
- [ ] API endpoint communication
- [ ] Error handling (network loss)

### API Testing (curl)

```bash
# Register
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123","full_name":"Test User","role":"Operator"}'

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Ingest temperature (ESP32)
curl -X POST http://localhost:8001/api/ingest-temperature \
  -H "Content-Type: application/json" \
  -d '{"api_key":"esp32_secure_key_123","machine_type":"CNC","temperature":42.5}'

# Predict (requires token)
curl -X POST http://localhost:8001/api/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"machine_type":"CNC","running_hours":10500,"feeding_rate":1200,"vibration":75,"maintenance_date":"2025-08-15"}'
```

## Future Enhancements

### Machine Learning Integration

1. **Data Collection Phase**
   - Continue using rule-based system
   - Collect 6-12 months of historical data
   - Label failure events

2. **Model Development**
   - Feature engineering (rolling averages, trends, anomalies)
   - Train gradient boosting classifier (XGBoost/LightGBM)
   - Develop LSTM for RUL estimation
   - Cross-validation and hyperparameter tuning

3. **Integration**
   - Add `/api/predict-ml` endpoint
   - Parallel predictions (rule-based + ML)
   - Gradual ML confidence threshold increase
   - A/B testing framework

4. **Monitoring**
   - Model drift detection
   - Retraining pipeline
   - Performance metrics tracking

### Additional Features
- Email/SMS alerts for critical conditions
- Multi-language support
- Mobile app (React Native)
- Real-time WebSocket updates
- Advanced analytics dashboard
- Maintenance scheduling system
- Parts inventory integration
- Multi-tenant support

## Troubleshooting

### Backend Issues

**MongoDB Connection Failed**
```bash
# Check MongoDB status
systemctl status mongod

# Check connection string
echo $MONGO_URL
```

**JWT Token Invalid**
- Check JWT_SECRET_KEY consistency
- Verify token expiration (24 hours)
- Clear browser localStorage

**API Key Rejected**
- Verify ESP32_API_KEY in backend .env
- Check ESP32 sketch configuration

### Frontend Issues

**API Calls Failing**
- Verify REACT_APP_BACKEND_URL
- Check CORS configuration
- Inspect browser console

**Charts Not Rendering**
- Verify Chart.js installation
- Check for data availability
- Inspect console errors

### ESP32 Issues

**WiFi Won't Connect**
- Verify SSID and password
- Check WiFi range
- Monitor serial output

**Temperature Reading NaN**
- Check DHT11 wiring
- Verify power supply (3.3V)
- Test with example sketch

**HTTP POST Failing**
- Verify server URL
- Check network connectivity
- Inspect API key

## Performance Optimization

### Backend
- Use connection pooling for MongoDB
- Implement caching for config data
- Add rate limiting for public endpoints
- Optimize prediction algorithm

### Frontend
- Code splitting for routes
- Lazy load Chart.js
- Implement virtual scrolling for history
- Optimize bundle size

### Database
- Create indexes:
  ```javascript
  db.predictions.createIndex({ machine_type: 1, prediction_date: -1 })
  db.users.createIndex({ email: 1 }, { unique: true })
  ```

## Monitoring & Logging

### Backend Logs
```bash
# View supervisor logs
tail -f /var/log/supervisor/backend.*.log

# Search for errors
grep ERROR /var/log/supervisor/backend.err.log
```

### Frontend Logs
- Browser console for client errors
- Network tab for API issues

### Database Monitoring
```javascript
// Check collection stats
db.predictions.stats()

// Recent predictions
db.predictions.find().sort({prediction_date: -1}).limit(10)
```

## Support & Maintenance

### Regular Tasks
- [ ] Weekly: Review error logs
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Security audit
- [ ] Annually: Performance review

### Backup Strategy
- Daily MongoDB backups
- Weekly full system backup
- Off-site backup storage
- Test restore procedures

---

**Version**: 1.0.0  
**Last Updated**: November 2025  
**Maintainer**: Emergent Labs
