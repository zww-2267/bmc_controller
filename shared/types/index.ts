// ========== 健康状态类型 ==========
export type SensorHealthLevel = 'OK' | 'Warning' | 'Critical';

export interface SensorValueWithHealth {
  value: number | null;
  health: SensorHealthLevel | null;
}

export interface AggregateHealthStatus {
  level: 'normal' | 'warning' | 'critical';
  reasons: string[];
}

// ========== 路由器 ==========
export interface Router {
  id: string;
  name: string;
  location: string;
  description?: string;
}

// ========== BMC ==========
export type BMCStatus = 'online' | 'offline' | 'warning' | 'error';

export interface BMC {
  id: string;
  ip: string;
  username: string;
  routerId: string;
  routerName?: string;
  status: BMCStatus;
  lastSeen: string;
  uptime: number;
  hostPowerOn: boolean;
  aggregateHealth: AggregateHealthStatus;
}

export interface BMCCreateInput {
  ip: string;
  username: string;
  password: string;
  routerId: string;
}

// ========== 传感器数据 ==========
export interface CoreTemp {
  cpu0Temp: SensorValueWithHealth;
  dimmG0Temp: SensorValueWithHealth;
  dimmG1Temp: SensorValueWithHealth;
  mbTemp1: SensorValueWithHealth;
  mbTemp2: SensorValueWithHealth;
  inletAirTemp: SensorValueWithHealth;
  cpu0Dts: SensorValueWithHealth;
  vrP0Temp: SensorValueWithHealth;
  vrDimmG0Temp: SensorValueWithHealth;
  vrDimmG1Temp: SensorValueWithHealth;
  m2G0AmbTemp: SensorValueWithHealth;
}

export interface GpuTemp {
  gpu0Proc: SensorValueWithHealth;
  gpu1Proc: SensorValueWithHealth;
  gpu2Proc: SensorValueWithHealth;
  gpu3Proc: SensorValueWithHealth;
  gpu4Proc: SensorValueWithHealth;
  gpu5Proc: SensorValueWithHealth;
  gpu6Proc: SensorValueWithHealth;
  gpu7Proc: SensorValueWithHealth;
  hddTemp: SensorValueWithHealth;
  pdbTemp1: SensorValueWithHealth;
  pdbTemp2: SensorValueWithHealth;
}

export interface FanSpeed {
  gpuFan12: SensorValueWithHealth;
  gpuFan56: SensorValueWithHealth;
  sysFan1: SensorValueWithHealth;
  sysFan2: SensorValueWithHealth;
  gpuFan34: SensorValueWithHealth;
  gpuFan78: SensorValueWithHealth;
  gpuFan12E: SensorValueWithHealth;
  gpuFan56E: SensorValueWithHealth;
}

export interface VoltageData {
  cpu0Vcore: SensorValueWithHealth;
  cpu0Vccin: SensorValueWithHealth;
  dimmG0Volt: SensorValueWithHealth;
  dimmG1Volt: SensorValueWithHealth;
  volt12v: SensorValueWithHealth;
  volt5v: SensorValueWithHealth;
  volt3v3: SensorValueWithHealth;
}

export interface CurrentData {
  cpu0Current: SensorValueWithHealth;
  dimmG0Current: SensorValueWithHealth;
  dimmG1Current: SensorValueWithHealth;
  gpu0Current: SensorValueWithHealth;
}

export interface PSUInfo {
  name: string;
  model: string;
  serialNumber: string;
  lastOutput: number;
  lineInput: number;
  health: string;
  state: string;
}

export interface PowerData {
  chassisPower: number;
  chassisPowerHealth: string;
  chassisPowerState: string;
}

export interface SensorData {
  bmcId: string;
  timestamp: string;
  coreTemp: CoreTemp;
  gpuTemp: GpuTemp;
  fanSpeed: FanSpeed;
  voltage: VoltageData;
  current: CurrentData;
  power: PowerData;
  psu: PSUInfo[];
  aggregateHealth: AggregateHealthStatus;
}

// ========== 传感器摘要（仪表盘用） ==========
export interface SensorSummary {
  bmcId: string;
  bmcIp: string;
  routerName: string;
  status: BMCStatus;
  cpu0Temp: number | null;
  inletAirTemp: number | null;
  chassisPower: number;
  health: AggregateHealthStatus;
  timestamp: string;
}

// ========== CPU 温度历史点（趋势图用） ==========
export interface CpuTempHistory {
  bmcId: string;
  bmcIp: string;
  points: { time: string; value: number | null }[];
}
