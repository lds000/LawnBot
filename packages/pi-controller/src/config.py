"""
Central configuration loader. Reads config/config.json and exposes typed settings.
GPIO mock mode is auto-enabled when not running on a Pi (for dev on PC).
"""
import json
import os
import platform
from pathlib import Path
from dataclasses import dataclass, field

_CONFIG_PATH = Path(__file__).parent.parent / "config" / "config.json"


def _load_raw() -> dict:
    with open(_CONFIG_PATH) as f:
        return json.load(f)


def _is_raspberry_pi() -> bool:
    try:
        with open("/proc/cpuinfo") as f:
            return "Raspberry Pi" in f.read()
    except Exception:
        return False


@dataclass
class MqttConfig:
    broker_host: str
    broker_port: int
    client_id: str


@dataclass
class ApiConfig:
    host: str
    port: int


@dataclass
class GpioConfig:
    relays: dict[str, int]
    leds: dict[str, int]
    mock: bool


@dataclass
class SensorPiConfig:
    host: str
    api_port: int


@dataclass
class AppConfig:
    device_id: str
    mqtt: MqttConfig
    api: ApiConfig
    gpio: GpioConfig
    sensor_pi: SensorPiConfig
    database_path: str
    schedule_file: str
    misters_overlap: bool
    log_level: str


def load_config() -> AppConfig:
    raw = _load_raw()
    on_pi = _is_raspberry_pi()
    mock = raw["gpio"].get("mock", False) or not on_pi

    return AppConfig(
        device_id=raw["device_id"],
        mqtt=MqttConfig(**raw["mqtt"]),
        api=ApiConfig(**raw["api"]),
        gpio=GpioConfig(
            relays=raw["gpio"]["relays"],
            leds=raw["gpio"]["leds"],
            mock=mock,
        ),
        sensor_pi=SensorPiConfig(**raw["sensor_pi"]),
        database_path=raw["database"]["path"],
        schedule_file=raw["schedule_file"],
        misters_overlap=raw.get("misters_overlap", True),
        log_level=raw.get("log_level", "INFO"),
    )


# Singleton
CONFIG = load_config()
