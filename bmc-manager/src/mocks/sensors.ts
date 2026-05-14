import type { SensorData, SensorSummary, CpuTempHistory, CoreTemp, GpuTemp, FanSpeed, VoltageData, CurrentData, PowerData, PSUInfo, SensorValueWithHealth, AggregateHealthStatus } from '../types';
import { mockBMCs } from './bmc';

function rnd(base: number, variance: number, decimals: number = 1): number {
  return +(base + (Math.random() - 0.5) * variance * 2).toFixed(decimals);
}

function randomHealth(): 'OK' | 'Warning' | 'Critical' {
  const r = Math.random();
  if (r < 0.85) return 'OK';
  if (r < 0.97) return 'Warning';
  return 'Critical';
}

function sv(base: number, variance: number): SensorValueWithHealth {
  if (Math.random() < 0.05) return { value: null, health: null };
  return { value: rnd(base, variance), health: randomHealth() };
}

function generateCoreTemp(): CoreTemp {
  return {
    cpu0Temp: sv(55, 15),
    dimmG0Temp: sv(42, 8),
    dimmG1Temp: sv(43, 8),
    mbTemp1: sv(38, 5),
    mbTemp2: sv(36, 5),
    inletAirTemp: sv(24, 3),
    cpu0Dts: sv(0, 20),
    vrP0Temp: sv(48, 10),
    vrDimmG0Temp: sv(45, 8),
    vrDimmG1Temp: sv(44, 8),
    m2G0AmbTemp: sv(35, 7),
  };
}

function generateGpuTemp(): GpuTemp {
  return {
    gpu0Proc: sv(65, 15),
    gpu1Proc: sv(63, 15),
    gpu2Proc: sv(67, 15),
    gpu3Proc: sv(61, 15),
    gpu4Proc: sv(64, 15),
    gpu5Proc: sv(66, 15),
    gpu6Proc: sv(62, 15),
    gpu7Proc: sv(68, 15),
    hddTemp: sv(35, 5),
    pdbTemp1: sv(32, 5),
    pdbTemp2: sv(33, 5),
  };
}

function generateFanSpeed(): FanSpeed {
  return {
    gpuFan12: sv(6500, 1500),
    gpuFan56: sv(6400, 1500),
    sysFan1: sv(4200, 800),
    sysFan2: sv(4100, 800),
    gpuFan34: sv(6600, 1500),
    gpuFan78: sv(6500, 1500),
    gpuFan12E: sv(6200, 1500),
    gpuFan56E: sv(6300, 1500),
  };
}

function generateVoltage(): VoltageData {
  return {
    cpu0Vcore: sv(1.8, 0.15),
    cpu0Vccin: sv(1.8, 0.15),
    dimmG0Volt: sv(1.2, 0.05),
    dimmG1Volt: sv(1.2, 0.05),
    volt12v: sv(12, 0.3),
    volt5v: sv(5, 0.1),
    volt3v3: sv(3.3, 0.05),
  };
}

function generateCurrent(): CurrentData {
  return {
    cpu0Current: sv(25, 10),
    dimmG0Current: sv(3, 1),
    dimmG1Current: sv(3, 1),
    gpu0Current: sv(45, 15),
  };
}

function generatePSU(): PSUInfo[] {
  return [
    {
      name: 'PSU1',
      model: 'DELTA DPS-2200AB-2 F',
      serialNumber: `ITFD20490${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
      lastOutput: rnd(1308, 200),
      lineInput: rnd(220, 10),
      health: Math.random() < 0.9 ? 'OK' : 'Warning',
      state: Math.random() < 0.95 ? 'Enabled' : 'Disabled',
    },
    {
      name: 'PSU2',
      model: 'DELTA DPS-2200AB-2 F',
      serialNumber: `ITFD20490${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
      lastOutput: Math.random() < 0.7 ? rnd(800, 400) : 0,
      lineInput: Math.random() < 0.7 ? rnd(220, 10) : 0,
      health: Math.random() < 0.85 ? 'OK' : 'N/A',
      state: Math.random() < 0.7 ? 'Enabled' : 'Disabled',
    },
  ];
}

function computeAggregateHealth(core: CoreTemp, _gpu: GpuTemp, _fan: FanSpeed, _volt: VoltageData, _curr: CurrentData, power: PowerData): AggregateHealthStatus {
  const reasons: string[] = [];
  let worst: 'normal' | 'warning' | 'critical' = 'normal';

  const check = (label: string, s: SensorValueWithHealth) => {
    if (!s.health || s.health === 'OK') return;
    if (s.health === 'Critical') worst = 'critical';
    else if (s.health === 'Warning' && worst === 'normal') worst = 'warning';
    reasons.push(`${label} 健康状态: ${s.health === 'Critical' ? '严重' : '警告'}`);
  };

  check('CPU0 Temp', core.cpu0Temp);
  check('DIMMG0 Temp', core.dimmG0Temp);
  check('DIMMG1 Temp', core.dimmG1Temp);
  check('Inlet Air', core.inletAirTemp);
  check('VR P0', core.vrP0Temp);

  if (power.chassisPowerHealth !== 'OK') {
    if (power.chassisPowerHealth === 'Critical') worst = 'critical';
    else if (worst === 'normal') worst = 'warning';
    reasons.push(`整机功耗 健康状态: ${power.chassisPowerHealth === 'Critical' ? '严重' : '警告'}`);
  }

  return { level: worst, reasons };
}

export function generateSensorData(bmcId: string): SensorData {
  const bmc = mockBMCs.find(b => b.id === bmcId);
  const isOffline = bmc?.status === 'offline' || bmc?.status === 'error';
  const critical = Math.random() < 0.05;

  const power: PowerData = {
    chassisPower: isOffline ? 0 : rnd(1308, 300),
    chassisPowerHealth: critical ? 'Critical' : 'OK',
    chassisPowerState: isOffline ? 'Disabled' : 'Enabled',
  };

  const coreTemp = isOffline ? {} as CoreTemp : generateCoreTemp();
  const gpuTemp = isOffline ? {} as GpuTemp : generateGpuTemp();
  const fanSpeed = isOffline ? {} as FanSpeed : generateFanSpeed();
  const voltage = isOffline ? {} as VoltageData : generateVoltage();
  const current = isOffline ? {} as CurrentData : generateCurrent();

  const aggregateHealth: AggregateHealthStatus = isOffline
    ? { level: 'critical', reasons: ['BMC 无响应'] }
    : computeAggregateHealth(coreTemp, gpuTemp, fanSpeed, voltage, current, power);

  return {
    bmcId,
    timestamp: new Date().toISOString(),
    coreTemp,
    gpuTemp,
    fanSpeed,
    voltage,
    current,
    power,
    psu: isOffline ? [] : generatePSU(),
    aggregateHealth,
  };
}

export function generateSensorSummary(): SensorSummary[] {
  return mockBMCs.slice(0, 200).map(bmc => {
    const isOnline = bmc.status === 'online' || bmc.status === 'warning';
    return {
      bmcId: bmc.id,
      bmcIp: bmc.ip,
      routerName: bmc.routerName || '',
      status: bmc.status,
      cpu0Temp: isOnline ? rnd(55, 15) : null,
      inletAirTemp: isOnline ? rnd(24, 3) : null,
      chassisPower: isOnline ? rnd(1308, 300) : 0,
      health: bmc.aggregateHealth ?? { level: 'normal', reasons: [] },
      timestamp: new Date().toISOString(),
    };
  });
}

export function generateCpuTempHistory(bmcId: string, minutes: number = 60): CpuTempHistory {
  const bmc = mockBMCs.find(b => b.id === bmcId);
  const points: { time: string; value: number | null }[] = [];
  const now = Date.now();
  const intervalMs = (minutes * 60000) / 60;

  for (let i = 60; i >= 0; i--) {
    const time = new Date(now - i * intervalMs).toISOString();
    const value = (bmc?.status === 'online' || bmc?.status === 'warning') ? rnd(55, 8) : null;
    points.push({ time, value });
  }

  return { bmcId, bmcIp: bmc?.ip || '', points };
}

export function generateMultiCpuHistory(bmcIds: string[], minutes: number = 30): CpuTempHistory[] {
  return bmcIds.map(id => generateCpuTempHistory(id, minutes));
}
