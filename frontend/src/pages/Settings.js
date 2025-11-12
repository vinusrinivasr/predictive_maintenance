import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Save, Key, Thermometer, Activity } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Settings = () => {
  const { getAuthHeader, user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sensorMode, setSensorMode] = useState('prototype_low_temp');
  const [thresholds, setThresholds] = useState({});
  const [apiKey, setApiKey] = useState('');

  const isManager = user?.role === 'Manager';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/config`, {
        headers: getAuthHeader()
      });
      setConfig(response.data);
      setSensorMode(response.data.sensor_mode || 'prototype_low_temp');
      setThresholds(response.data.thresholds || {});
      setApiKey(response.data.api_key || '');
    } catch (error) {
      toast.error('Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isManager) {
      toast.error('Only managers can update configuration');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/config`, {
        sensor_mode: sensorMode,
        thresholds: thresholds,
        api_key: apiKey
      }, {
        headers: getAuthHeader()
      });
      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = (category, machine, type, value) => {
    setThresholds(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [machine]: {
          ...prev[category]?.[machine],
          [type]: parseFloat(value) || 0
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">System Settings</h2>
          <p className="text-slate-600">Configure thresholds and sensor parameters</p>
        </div>
        {isManager && (
          <Button
            data-testid="save-settings-button"
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {saving ? (
              <span className="flex items-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Saving...
              </span>
            ) : (
              <span className="flex items-center">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </span>
            )}
          </Button>
        )}
      </div>

      {!isManager && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Only managers can modify system settings. Contact your manager to make changes.
          </p>
        </Card>
      )}

      <Tabs defaultValue="sensor" className="space-y-6">
        <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200">
          <TabsTrigger data-testid="sensor-tab" value="sensor" className="flex items-center space-x-2">
            <Thermometer className="w-4 h-4" />
            <span>Sensor Mode</span>
          </TabsTrigger>
          <TabsTrigger data-testid="thresholds-tab" value="thresholds" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Thresholds</span>
          </TabsTrigger>
          <TabsTrigger data-testid="api-tab" value="api" className="flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>API Key</span>
          </TabsTrigger>
        </TabsList>

        {/* Sensor Mode */}
        <TabsContent value="sensor">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Temperature Sensor Mode</h3>
            
            <div className="space-y-4">
              <div
                onClick={() => isManager && setSensorMode('prototype_low_temp')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  sensorMode === 'prototype_low_temp'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!isManager && 'opacity-60 cursor-not-allowed'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold text-slate-900">Prototype Low Temp (DHT11)</h4>
                      {sensorMode === 'prototype_low_temp' && (
                        <Badge className="bg-blue-600 text-white">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      For demo and testing with DHT11 sensor (0-50°C range)
                    </p>
                    <div className="mt-2 text-xs text-slate-500">
                      Thresholds: Green ≤40°C, Yellow 40-45°C, Red &gt;45°C
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => isManager && setSensorMode('shopfloor_high_temp')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  sensorMode === 'shopfloor_high_temp'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!isManager && 'opacity-60 cursor-not-allowed'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold text-slate-900">Shop Floor High Temp (Industrial)</h4>
                      {sensorMode === 'shopfloor_high_temp' && (
                        <Badge className="bg-blue-600 text-white">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      For production with industrial sensors (DS18B20/PT100, up to 120°C)
                    </p>
                    <div className="mt-2 text-xs text-slate-500">
                      Machine-specific thresholds apply (configurable below)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Thresholds */}
        <TabsContent value="thresholds">
          <div className="space-y-4">
            {/* Temperature Thresholds */}
            {sensorMode === 'shopfloor_high_temp' && (
              <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Temperature Thresholds (°C)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['CNC', 'EDM', 'Lathe', 'Grinding'].map(machine => (
                    <div key={machine} className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="font-medium text-slate-900 mb-3">{machine}</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Label className="w-20 text-sm">Green:</Label>
                          <Input
                            data-testid={`temp-${machine.toLowerCase()}-green`}
                            type="number"
                            value={thresholds.shopfloor_high_temp?.[machine]?.green || 0}
                            onChange={(e) => updateThreshold('shopfloor_high_temp', machine, 'green', e.target.value)}
                            disabled={!isManager}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label className="w-20 text-sm">Yellow:</Label>
                          <Input
                            data-testid={`temp-${machine.toLowerCase()}-yellow`}
                            type="number"
                            value={thresholds.shopfloor_high_temp?.[machine]?.yellow || 0}
                            onChange={(e) => updateThreshold('shopfloor_high_temp', machine, 'yellow', e.target.value)}
                            disabled={!isManager}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label className="w-20 text-sm">Red:</Label>
                          <Input
                            data-testid={`temp-${machine.toLowerCase()}-red`}
                            type="number"
                            value={thresholds.shopfloor_high_temp?.[machine]?.red || 0}
                            onChange={(e) => updateThreshold('shopfloor_high_temp', machine, 'red', e.target.value)}
                            disabled={!isManager}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Vibration Thresholds */}
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Vibration Thresholds (µm)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['CNC', 'EDM', 'Lathe', 'Grinding'].map(machine => (
                  <div key={machine} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-3">{machine}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Green:</Label>
                        <Input
                          data-testid={`vib-${machine.toLowerCase()}-green`}
                          type="number"
                          value={thresholds.vibration?.[machine]?.green || 0}
                          onChange={(e) => updateThreshold('vibration', machine, 'green', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Yellow:</Label>
                        <Input
                          data-testid={`vib-${machine.toLowerCase()}-yellow`}
                          type="number"
                          value={thresholds.vibration?.[machine]?.yellow || 0}
                          onChange={(e) => updateThreshold('vibration', machine, 'yellow', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Feed Rate & Running Hours - Similar structure */}
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Feed Rate Thresholds (mm/min)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['CNC', 'EDM', 'Lathe', 'Grinding'].map(machine => (
                  <div key={machine} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-3">{machine}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Green:</Label>
                        <Input
                          type="number"
                          value={thresholds.feed_rate?.[machine]?.green || 0}
                          onChange={(e) => updateThreshold('feed_rate', machine, 'green', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Yellow:</Label>
                        <Input
                          type="number"
                          value={thresholds.feed_rate?.[machine]?.yellow || 0}
                          onChange={(e) => updateThreshold('feed_rate', machine, 'yellow', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Running Hours Thresholds (h)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['CNC', 'EDM', 'Lathe', 'Grinding'].map(machine => (
                  <div key={machine} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-3">{machine}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Green:</Label>
                        <Input
                          type="number"
                          value={thresholds.running_hours?.[machine]?.green || 0}
                          onChange={(e) => updateThreshold('running_hours', machine, 'green', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">Yellow:</Label>
                        <Input
                          type="number"
                          value={thresholds.running_hours?.[machine]?.yellow || 0}
                          onChange={(e) => updateThreshold('running_hours', machine, 'yellow', e.target.value)}
                          disabled={!isManager}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* API Key */}
        <TabsContent value="api">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">ESP32 API Key</h3>
            <p className="text-sm text-slate-600 mb-4">
              This key is used by ESP32 devices to authenticate temperature data ingestion.
            </p>
            <div>
              <Label>API Key</Label>
              <Input
                data-testid="api-key-input"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!isManager}
                placeholder="Enter API key for ESP32"
                className="mt-1 font-mono"
              />
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Usage Example</h4>
              <pre className="text-xs text-slate-700 overflow-x-auto">
{`POST ${BACKEND_URL}/api/ingest-temperature
Content-Type: application/json

{
  "api_key": "${apiKey || 'your_api_key'}",
  "machine_type": "CNC",
  "temperature": 42.5
}`}
              </pre>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
