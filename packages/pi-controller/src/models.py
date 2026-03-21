"""
Pydantic models for API request/response validation.
Single source of truth for data shapes — shared with FastAPI endpoints.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, field_validator


# --- Schedule models ---

class ScheduleSet(BaseModel):
    name: str
    duration_minutes: float
    pulse_minutes: Optional[float] = None
    soak_minutes: Optional[float] = None
    mode: str = "normal"
    enabled: bool = True
    flow_rate_lpm: Optional[float] = None
    soil_moisture_skip_threshold: Optional[float] = None

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v):
        if v not in ("normal", "pulse_soak"):
            raise ValueError("mode must be 'normal' or 'pulse_soak'")
        return v


class StartTime(BaseModel):
    time: str  # "HH:MM"
    enabled: bool = True
    sets: list[ScheduleSet] = []

    @field_validator("time")
    @classmethod
    def validate_time(cls, v):
        from datetime import datetime
        datetime.strptime(v, "%H:%M")
        return v


class MistSettings(BaseModel):
    enabled: bool = False
    trigger_temp_f: float = 95.0
    duration_seconds: int = 60
    check_interval_minutes: int = 20


class RainSkipSettings(BaseModel):
    enabled: bool = False
    threshold_percent: int = 50


class Schedule(BaseModel):
    start_times: list[StartTime] = []
    schedule_days: list[bool] = [True] * 14
    mist_settings: MistSettings = MistSettings()
    rain_skip: RainSkipSettings = RainSkipSettings()

    @field_validator("schedule_days")
    @classmethod
    def validate_days(cls, v):
        if len(v) != 14:
            raise ValueError("schedule_days must have exactly 14 entries")
        return v


# --- Run state models ---

class RunPhase(BaseModel):
    type: str  # "watering" | "soaking"
    remaining_seconds: int
    detail: str = ""


class CurrentRun(BaseModel):
    zone_name: str
    run_id: str
    total_seconds: int
    remaining_seconds: int
    phase: str
    phase_detail: str = ""
    is_manual: bool
    start_time: str


class NextRun(BaseModel):
    set_name: str
    scheduled_time: str
    duration_minutes: float
    run_id: str


# --- API request models ---

class ManualRunRequest(BaseModel):
    set_name: str
    duration_minutes: float

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v):
        if v <= 0 or v > 120:
            raise ValueError("duration_minutes must be between 0 and 120")
        return v


class ScheduleUpdateRequest(BaseModel):
    schedule: Schedule


# --- Status response model ---

class ZoneState(BaseModel):
    name: str
    relay_on: bool
    status: str  # "idle" | "watering" | "soaking" | "scheduled-soon"


class SystemStatusResponse(BaseModel):
    system_status: str
    test_mode: bool
    current_run: Optional[CurrentRun] = None
    next_run: Optional[NextRun] = None
    last_completed_run: Optional[dict] = None
    upcoming_runs: list[NextRun] = []
    zone_states: list[ZoneState] = []
    today_is_watering_day: bool
    schedule_day_index: int
    is_misting: bool
    rain_skip_active: bool = False
    timestamp: str


# --- Sensor models ---

class EnvironmentReading(BaseModel):
    timestamp: str
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    wind_direction_compass: Optional[str] = None


class FlowPressureReading(BaseModel):
    timestamp: str
    flow_litres: Optional[float] = None
    flow_rate_lpm: Optional[float] = None
    pressure_psi: Optional[float] = None
    pressure_kpa: Optional[float] = None


# --- History model ---

class HistoryEntry(BaseModel):
    id: int
    run_id: str
    set_name: str
    start_time: str
    end_time: Optional[str] = None
    duration_seconds: Optional[int] = None
    estimated_litres: Optional[float] = None
    is_manual: bool
    completed: bool
    skip_reason: Optional[str] = None


# --- Config models ---

class LocationConfig(BaseModel):
    latitude: float
    longitude: float
    timezone: str = "America/Denver"


class LocationUpdateRequest(BaseModel):
    location: LocationConfig
