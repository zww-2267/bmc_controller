// ========== 路由器 ==========
export interface Router {
  id: string;
  name: string;
  location: string;
  description?: string;
}

// ========== BMC ==========
export type BMCStatus = 'online' | 'offline' | 'error';

export interface BMC {
  id: string;
  ip: string;
  username: string;
  routerId: string;
  routerName?: string;
  status: BMCStatus;
  lastSeen: string; // ISO datetime
  uptime: number; // 已运行时间，单位秒
}

export interface BMCCreateInput {
  ip: string;
  username: string;
  password: string;
  routerId: string;
}

// ========== 传感器数据 ==========
export interface CoreTemp {
  cpu0Temp: number | null;
  dimmG0Temp: number | null;
  dimmG1Temp: number | null;
  mbTemp1: number | null;
  mbTemp2: number | null;
  inletAirTemp: number | null;
  cpu0Dts: number | null;
  vrP0Temp: number | null;
  vrDimmG0Temp: number | null;
  vrDimmG1Temp: number | null;
  m2G0AmbTemp: number | null;
}

export interface GpuTemp {
  gpu0Proc: number | null;
  gpu1Proc: number | null;
  gpu2Proc: number | null;
  gpu3Proc: number | null;
  gpu4Proc: number | null;
  gpu5Proc: number | null;
  gpu6Proc: number | null;
  gpu7Proc: number | null;
  hddTemp: number | null;
  pdbTemp1: number | null;
  pdbTemp2: number | null;
}

export interface FanSpeed {
  gpuFan12: number | null;
  gpuFan56: number | null;
  sysFan1: number | null;
  sysFan2: number | null;
  gpuFan34: number | null;
  gpuFan78: number | null;
  gpuFan12E: number | null;
  gpuFan56E: number | null;
}

export interface VoltageData {
  // 核心电压 (CPU VRM/内存供电)
  cpu0Vcore: number | null;
  cpu0Vccin: number | null;
  dimmG0Volt: number | null;
  dimmG1Volt: number | null;
  // 基础电压 (12V/5V/3.3V)
  volt12v: number | null;
  volt5v: number | null;
  volt3v3: number | null;
}

export interface CurrentData {
  cpu0Current: number | null;
  dimmG0Current: number | null;
  dimmG1Current: number | null;
  gpu0Current: number | null;
}

export interface PSUInfo {
  name: string;
  model: string;
  serialNumber: string;
  lastOutput: number; // W
  lineInput: number; // VAC
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
  hasError: boolean;
  timestamp: string;
}

// ========== CPU 温度历史点（趋势图用） ==========
export interface CpuTempHistory {
  bmcId: string;
  bmcIp: string;
  points: { time: string; value: number | null }[];
}
