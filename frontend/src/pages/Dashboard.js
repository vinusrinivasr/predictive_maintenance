import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { getAuthHeader } = useAuth();
  const [machineType, setMachineType] = useState('CNC');
  const [formData, setFormData] = useState({
    running_hours: '',
    feeding_rate: '',
    temperature: '',
    vibration: '',
    maintenance_date: ''
  });
  const [autoTemp, setAutoTemp] = useState(true);
  const [latestTemp, setLatestTemp] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (autoTemp) {
      fetchLatestTemperature();
    }
  }, [machineType, autoTemp]);

  const fetchLatestTemperature = async () => {
    try {
      const response = await axios.get(`${API}/latest-temperature?machine_type=${machineType}`, {
        headers: getAuthHeader()
      });
      setLatestTemp(response.data);
      if (response.data.temperature !== null) {
        setFormData(prev => ({ ...prev, temperature: response.data.temperature.toString() }));
      }
    } catch (error) {
      console.error('Failed to fetch temperature:', error);
    }
  };

  const handleAnalyze = async () => {
    // Validation
    if (!formData.running_hours || !formData.feeding_rate || !formData.vibration || !formData.maintenance_date) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!autoTemp && !formData.temperature) {
      toast.error('Please provide temperature value');
      return;
    }

    setAnalyzing(true);
    try {
      const payload = {
        machine_type: machineType,
        running_hours: parseFloat(formData.running_hours),
        feeding_rate: parseFloat(formData.feeding_rate),
        vibration: parseFloat(formData.vibration),
        maintenance_date: formData.maintenance_date,
      };

      if (!autoTemp) {
        payload.temperature = parseFloat(formData.temperature);
      }

      const response = await axios.post(`${API}/predict`, payload, {
        headers: getAuthHeader()
      });

      setResult(response.data);
      toast.success('Analysis complete!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const getConditionColor = (level) => {
    switch (level) {
      case 'Good': return 'bg-emerald-500';
      case 'Medium': return 'bg-amber-500';
      case 'Critical': return 'bg-rose-500';
      default: return 'bg-gray-500';
    }
  };

  const getConditionIcon = (level) => {
    switch (level) {
      case 'Good': return <CheckCircle className="w-6 h-6" />;
      case 'Medium': return <AlertCircle className="w-6 h-6" />;
      case 'Critical': return <AlertTriangle className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  const getRiskColor = (score) => {
    if (score < 35) return 'from-emerald-500 to-emerald-600';
    if (score < 70) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Machine Analysis Dashboard</h2>
        <p className="text-slate-600">Monitor and predict machine health in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-2">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Machine Parameters</h3>
            
            <div className="space-y-4">
              {/* Machine Type */}
              <div>
                <Label>Machine Type</Label>
                <Select value={machineType} onValueChange={setMachineType}>
                  <SelectTrigger data-testid="machine-type-select" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNC">CNC Machine</SelectItem>
                    <SelectItem value="EDM">EDM Machine</SelectItem>
                    <SelectItem value="Lathe">Lathe Machine</SelectItem>
                    <SelectItem value="Grinding">Grinding Machine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Temperature (°C)</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      data-testid="auto-temp-checkbox"
                      checked={autoTemp}
                      onCheckedChange={setAutoTemp}
                      id="auto-temp"
                    />
                    <label htmlFor="auto-temp" className="text-sm text-slate-600 cursor-pointer">
                      Auto-fetch from sensor
                    </label>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Input
                    data-testid="temperature-input"
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                    placeholder="Temperature"
                    disabled={autoTemp}
                    className="flex-1"
                  />
                  {autoTemp && (
                    <Button
                      data-testid="refresh-temp-button"
                      variant="outline"
                      size="icon"
                      onClick={fetchLatestTemperature}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {latestTemp?.updated_at && autoTemp && (
                  <p className="text-xs text-slate-500 mt-1">
                    Last updated: {new Date(latestTemp.updated_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Running Hours */}
              <div>
                <Label>Running Hours (h)</Label>
                <Input
                  data-testid="running-hours-input"
                  type="number"
                  step="0.1"
                  value={formData.running_hours}
                  onChange={(e) => setFormData({...formData, running_hours: e.target.value})}
                  placeholder="e.g., 10500"
                  className="mt-1"
                />
              </div>

              {/* Feed Rate */}
              <div>
                <Label>Feed Rate (mm/min)</Label>
                <Input
                  data-testid="feed-rate-input"
                  type="number"
                  step="0.1"
                  value={formData.feeding_rate}
                  onChange={(e) => setFormData({...formData, feeding_rate: e.target.value})}
                  placeholder="e.g., 1200"
                  className="mt-1"
                />
              </div>

              {/* Vibration */}
              <div>
                <Label>Vibration (µm)</Label>
                <Input
                  data-testid="vibration-input"
                  type="number"
                  step="0.1"
                  value={formData.vibration}
                  onChange={(e) => setFormData({...formData, vibration: e.target.value})}
                  placeholder="e.g., 75"
                  className="mt-1"
                />
              </div>

              {/* Last Maintenance Date */}
              <div>
                <Label>Last Maintenance Date</Label>
                <Input
                  data-testid="maintenance-date-input"
                  type="date"
                  value={formData.maintenance_date}
                  onChange={(e) => setFormData({...formData, maintenance_date: e.target.value})}
                  className="mt-1"
                />
              </div>

              <Button
                data-testid="analyze-button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Activity className="w-4 h-4 mr-2" />
                    Analyze Performance
                  </span>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Condition Level */}
              <Card data-testid="condition-card" className={`p-6 ${getConditionColor(result.condition_level)} text-white`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium uppercase tracking-wide">Condition Level</h3>
                  {getConditionIcon(result.condition_level)}
                </div>
                <p className="text-3xl font-bold">{result.condition_level}</p>
              </Card>

              {/* Risk Score */}
              <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
                <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Risk Score</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span data-testid="risk-score" className="text-4xl font-bold text-slate-900">{result.risk_score}</span>
                    <span className="text-sm text-slate-500">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getRiskColor(result.risk_score)} transition-all duration-500`}
                      style={{ width: `${result.risk_score}%` }}
                    ></div>
                  </div>
                </div>
              </Card>

              {/* Alerts */}
              <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
                <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Alerts</h3>
                <div data-testid="alerts-list" className="space-y-2">
                  {result.alerts.map((alert, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="w-full justify-start text-left py-2 px-3"
                    >
                      {alert}
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* Explanation */}
              <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
                <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Detailed Explanation</h3>
                <p data-testid="explanation-text" className="text-sm text-slate-700 leading-relaxed">{result.explanation}</p>
              </Card>
            </>
          ) : (
            <Card className="p-8 bg-white/60 backdrop-blur-sm border-slate-200 border-dashed">
              <div className="text-center text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Enter machine parameters and click "Analyze Performance" to see results</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
