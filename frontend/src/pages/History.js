import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const History = () => {
  const { getAuthHeader } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    machine_type: '',
    from_date: '',
    to_date: ''
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.machine_type) params.append('machine_type', filters.machine_type);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      params.append('limit', '100');

      const response = await axios.get(`${API}/history?${params.toString()}`, {
        headers: getAuthHeader()
      });
      setHistory(response.data);
    } catch (error) {
      toast.error('Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchHistory();
  };

  const handleClearFilters = () => {
    setFilters({ machine_type: '', from_date: '', to_date: '' });
    setTimeout(() => fetchHistory(), 100);
  };

  const exportToCSV = () => {
    if (history.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Machine Type', 'Running Hours', 'Feed Rate', 'Temperature', 'Vibration', 'Maintenance Date', 'Prediction Date', 'Risk Score', 'Condition Level'];
    const rows = history.map(h => [
      h.machine_type,
      h.running_hours,
      h.feeding_rate,
      h.temperature,
      h.vibration,
      h.maintenance_date,
      new Date(h.prediction_date).toLocaleString(),
      h.risk_score,
      h.condition_level
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('History exported successfully');
  };

  const getConditionBadge = (level) => {
    const colors = {
      'Good': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Medium': 'bg-amber-100 text-amber-800 border-amber-200',
      'Critical': 'bg-rose-100 text-rose-800 border-rose-200'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Prediction History</h2>
          <p className="text-slate-600">View past machine analysis records</p>
        </div>
        <Button
          data-testid="export-csv-button"
          onClick={exportToCSV}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm">Machine Type</Label>
            <Select value={filters.machine_type} onValueChange={(val) => setFilters({...filters, machine_type: val})}>
              <SelectTrigger data-testid="filter-machine-select" className="mt-1">
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All machines</SelectItem>
                <SelectItem value="CNC">CNC</SelectItem>
                <SelectItem value="EDM">EDM</SelectItem>
                <SelectItem value="Lathe">Lathe</SelectItem>
                <SelectItem value="Grinding">Grinding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm">From Date</Label>
            <Input
              data-testid="filter-from-date"
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters({...filters, from_date: e.target.value})}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label className="text-sm">To Date</Label>
            <Input
              data-testid="filter-to-date"
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
              className="mt-1"
            />
          </div>
          
          <div className="flex items-end space-x-2">
            <Button data-testid="apply-filters-button" onClick={handleApplyFilters} className="flex-1">
              Apply
            </Button>
            <Button data-testid="clear-filters-button" onClick={handleClearFilters} variant="outline" className="flex-1">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* History Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-slate-600">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p>No prediction records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="history-table" className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Machine</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Running Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Feed Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Temp (°C)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Vibration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Risk Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((record, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{record.machine_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.running_hours.toFixed(0)} h</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.feeding_rate.toFixed(0)} mm/min</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.temperature.toFixed(1)}°C</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.vibration.toFixed(0)} µm</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{record.risk_score}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getConditionBadge(record.condition_level)} text-xs`}>
                        {record.condition_level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(record.prediction_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <div className="text-center text-sm text-slate-500">
          Showing {history.length} record{history.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default History;
