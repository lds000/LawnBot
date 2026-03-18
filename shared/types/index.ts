// Zone / Watering types
export interface Zone {
  name: string;
  gpio_pin: number;
  enabled: boolean;
}

export type ZoneStatus = 'idle' | 'watering' | 'soaking' | 'scheduled-soon' | 'error';

export interface ZoneState {
  name: string;
  status: ZoneStatus;
  relay_on: boolean;
}

// Schedule types
export interface ScheduleSet {
  name: string;
  duration_minutes: number;
  pulse_minutes?: number;
  soak_minutes?: number;
  mode: 'normal' | 'pulse_soak';
  enabled: boolean;
}

export interface StartTime {
  time: string; // "HH:MM"
  enabled: boolean;
  sets: ScheduleSet[];
}

export interface Schedule {
  start_times: StartTime[];
  schedule_days: boolean[]; // 14-day rotation
  mist_settings: MistSettings;
}

export interface MistSettings {
  enabled: boolean;
  trigger_temp_f: number;
  duration_seconds: number;
  check_interval_minutes: number;
}

// Current run state
export interface RunPhase {
  type: 'watering' | 'soaking';
  remaining_seconds: number;
  pulse_number?: number;
  total_pulses?: number;
}

export interface CurrentRun {
  set_name: string;
  start_time: string; // ISO
  duration_minutes: number;
  phase: RunPhase | null;
  time_remaining_seconds: number;
  is_manual: boolean;
  run_id: string;
}

export interface NextRun {
  set_name: string;
  scheduled_time: string; // ISO
  duration_minutes: number;
}

// Full system status (from /api/status WebSocket)
export interface SystemStatus {
  system_status: string;
  test_mode: boolean;
  current_run: CurrentRun | null;
  next_run: NextRun | null;
  last_completed_run: CurrentRun | null;
  upcoming_runs: NextRun[];
  zone_states: ZoneState[];
  today_is_watering_day: boolean;
  schedule_day_index: number;
  is_misting: boolean;
  timestamp: string; // ISO
}

// Sensor data types
export interface EnvironmentReading {
  timestamp: string;
  temperature_c: number | null;
  humidity_percent: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  wind_direction_compass: string | null;
}

export interface FlowPressureReading {
  timestamp: string;
  flow_litres: number | null;
  flow_rate_lpm: number | null;
  pressure_psi: number | null;
  pressure_kpa: number | null;
}

export interface PlantReading {
  timestamp: string;
  moisture: number | null;
  lux: number | null;
  soil_temperature_c: number | null;
}

export interface SensorStatus {
  environment: EnvironmentReading | null;
  flow_pressure: FlowPressureReading | null;
  plant: PlantReading | null;
  online: boolean;
  last_seen: string | null;
}

// Watering history
export interface HistoryEntry {
  id: number;
  set_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  is_manual: boolean;
  run_id: string;
  completed: boolean;
}

// API request types
export interface ManualRunRequest {
  set_name: string;
  duration_minutes: number;
}

export interface ScheduleUpdateRequest {
  schedule: Schedule;
}

// WebSocket message envelope
export interface WsMessage<T = unknown> {
  type: 'status' | 'sensor' | 'error' | 'history_update';
  data: T;
  timestamp: string;
}
