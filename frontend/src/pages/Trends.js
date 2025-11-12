import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Trends = () => {
  const { getAuthHeader } = useAuth();
  const [machineType, setMachineType] = useState('CNC');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [machineType]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/history?machine_type=${machineType}&limit=50`, {
        headers: getAuthHeader()
      });
      setHistory(response.data.reverse()); // Show oldest to newest
    } catch (error) {
      toast.error('Failed to fetch trends data');
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: history.map(h => new Date(h.prediction_date).toLocaleDateString()),
    datasets: [
      {
        label: 'Risk Score',
        data: history.map(h => h.risk_score),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: history.map(h => {
          if (h.risk_score < 35) return 'rgb(16, 185, 129)';
          if (h.risk_score < 70) return 'rgb(245, 158, 11)';
          return 'rgb(239, 68, 68)';
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            return `Risk Score: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value) {
            return value;
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // Mini charts for temperature and vibration
  const temperatureData = {
    labels: history.map(h => new Date(h.prediction_date).toLocaleDateString()),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: history.map(h => h.temperature),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const vibrationData = {
    labels: history.map(h => new Date(h.prediction_date).toLocaleDateString()),
    datasets: [
      {
        label: 'Vibration (µm)',
        data: history.map(h => h.vibration),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const miniChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        display: false,
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Risk Score Trends</h2>
          <p className="text-slate-600">Monitor machine health over time</p>
        </div>
        <div className="w-48">
          <Select value={machineType} onValueChange={setMachineType}>
            <SelectTrigger data-testid="trends-machine-select">
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
      </div>

      {/* Main Risk Score Chart */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-600">Loading trends...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No historical data available for {machineType}</p>
            </div>
          </div>
        ) : (
          <div data-testid="risk-score-chart" className="h-96">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </Card>

      {/* Mini Charts */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">Temperature Trend</h3>
            <div className="h-48">
              <Line data={temperatureData} options={miniChartOptions} />
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">Vibration Trend</h3>
            <div className="h-48">
              <Line data={vibrationData} options={miniChartOptions} />
            </div>
          </Card>
        </div>
      )}

      {/* Future Scope Card */}
      <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Future Scope: Advanced ML Integration</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Upgrade to machine learning models for more accurate predictions:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• <strong>Gradient Boosting:</strong> Probability-based failure prediction</li>
              <li>• <strong>LSTM Networks:</strong> Remaining Useful Life (RUL) estimation</li>
              <li>• <strong>Anomaly Detection:</strong> Real-time pattern recognition</li>
              <li>• <strong>Historical Learning:</strong> Train models on accumulated prediction data</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Trends;
