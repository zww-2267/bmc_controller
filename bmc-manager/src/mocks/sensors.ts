import type { SensorData, SensorSummary, CpuTempHistory, CoreTemp, GpuTemp, FanSpeed, VoltageData, CurrentData, PowerData, PSUInfo } from '../types';
import { mockBMCs } from './bmc';

// ---- 工具函数 ----

function rnd(base: number, variance: number, decimals: number = 1): number {
  return +(base + (Math.random() - 0.5) * variance * 2).toFixed(decimals);
}

function maybeRnd(base: number, variance: number, nullChance: number = 0.05): number | null {
  return Math.random() < nullChance ? null : rnd(base, variance);
}

// ---- 单次生成 CoreTemp ----
function generateCoreTemp(): CoreTemp {
  return {
    cpu0Temp: maybeRnd(55, 15),
    dimmG0Temp: maybeRnd(42, 8),
    dimmG1Temp: maybeRnd(43, 8),
    mbTemp1: maybeRnd(38, 5),
    mbTemp2: maybeRnd(36, 5),
    inletAirTemp: maybeRnd(24, 3),
    cpu0Dts: maybeRnd(0, 20),
    vrP0Temp: maybeRnd(48, 10),
    vrDimmG0Temp: maybeRnd(45, 8),
    vrDimmG1Temp: maybeRnd(44, 8),
    m2G0AmbTemp: maybeRnd(35, 7),
  };
}

function generateGpuTemp(): GpuTemp {
  return {
    gpu0Proc: maybeRnd(65, 15),
    gpu1Proc: maybeRnd(63, 15),
    gpu2Proc: maybeRnd(67, 15),
    gpu3Proc: maybeRnd(61, 15),
    gpu4Proc: maybeRnd(64, 15),
    gpu5Proc: maybeRnd(66, 15),
    gpu6Proc: maybeRnd(62, 15),
    gpu7Proc: maybeRnd(68, 15),
    hddTemp: maybeRnd(35, 5),
    pdbTemp1: maybeRnd(32, 5),
    pdbTemp2: maybeRnd(33, 5),
  };
}

function generateFanSpeed(): FanSpeed {
  return {
    gpuFan12: maybeRnd(6500, 1500),
    gpuFan56: maybeRnd(6400, 1500),
    sysFan1: maybeRnd(4200, 800),
    sysFan2: maybeRnd(4100, 800),
    gpuFan34: maybeRnd(6600, 1500),
    gpuFan78: maybeRnd(6500, 1500),
    gpuFan12E: maybeRnd(6200, 1500),
    gpuFan56E: maybeRnd(6300, 1500),
  };
}

function generateVoltage(): VoltageData {
  return {
    cpu0Vcore: maybeRnd(1.8, 0.15),
    cpu0Vccin: maybeRnd(1.8, 0.15),
    dimmG0Volt: maybeRnd(1.2, 0.05),
    dimmG1Volt: maybeRnd(1.2, 0.05),
    volt12v: maybeRnd(12, 0.3),
    volt5v: maybeRnd(5, 0.1),
    volt3v3: maybeRnd(3.3, 0.05),
  };
}

function generateCurrent(): CurrentData {
  return {
    cpu0Current: maybeRnd(25, 10),
    dimmG0Current: maybeRnd(3, 1),
    dimmG1Current: maybeRnd(3, 1),
    gpu0Current: maybeRnd(45, 15),
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

// ---- 生成单台 BMC 的完整传感器数据 ----
export function generateSensorData(bmcId: string): SensorData {
  const isOffline = mockBMCs.find(b => b.id === bmcId)?.status !== 'online';
  const critical = Math.random() < 0.05; // 5% 概率出现 Critical

  const power: PowerData = {
    chassisPower: isOffline ? 0 : rnd(1308, 300),
    chassisPowerHealth: critical ? 'Critical' : 'OK',
    chassisPowerState: isOffline ? 'Disabled' : 'Enabled',
  };

  return {
    bmcId,
    timestamp: new Date().toISOString(),
    coreTemp: isOffline ? {} as CoreTemp : generateCoreTemp(),
    gpuTemp: isOffline ? {} as GpuTemp : generateGpuTemp(),
    fanSpeed: isOffline ? {} as FanSpeed : generateFanSpeed(),
    voltage: isOffline ? {} as VoltageData : generateVoltage(),
    current: isOffline ? {} as CurrentData : generateCurrent(),
    power,
    psu: isOffline ? [] : generatePSU(),
  };
}

// ---- 生成全局传感器摘要（仪表盘用） ----
export function generateSensorSummary(): SensorSummary[] {
  return mockBMCs.slice(0, 200).map(bmc => {
    const isOnline = bmc.status === 'online';
    return {
      bmcId: bmc.id,
      bmcIp: bmc.ip,
      routerName: bmc.routerName || '',
      status: bmc.status,
      cpu0Temp: isOnline ? maybeRnd(55, 15) : null,
      inletAirTemp: isOnline ? maybeRnd(24, 3) : null,
      chassisPower: isOnline ? rnd(1308, 300) : 0,
      hasError: bmc.status === 'error' || (isOnline && Math.random() < 0.05),
      timestamp: new Date().toISOString(),
    };
  });
}

// ---- 生成 CPU 温度历史数据（趋势图用） ----
export function generateCpuTempHistory(bmcId: string, minutes: number = 60): CpuTempHistory {
  const bmc = mockBMCs.find(b => b.id === bmcId);
  const points: { time: string; value: number | null }[] = [];
  const now = Date.now();
  const intervalMs = (minutes * 60000) / 60; // 60 个数据点

  for (let i = 60; i >= 0; i--) {
    const time = new Date(now - i * intervalMs).toISOString();
    const value = bmc?.status === 'online' ? rnd(55, 8) : null;
    points.push({ time, value });
  }

  return { bmcId, bmcIp: bmc?.ip || '', points };
}

// ---- 生成多台 BMC 的 CPU 温度趋势（仪表盘用） ----
export function generateMultiCpuHistory(bmcIds: string[], minutes: number = 30): CpuTempHistory[] {
  return bmcIds.map(id => generateCpuTempHistory(id, minutes));
}
