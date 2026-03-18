"""
Async-safe GPIO controller for relay and RGB LED control.
In mock mode (dev on PC / test), all hardware calls are logged instead of executed.
"""
import asyncio
import logging
from typing import Optional
from src.config import CONFIG

log = logging.getLogger(__name__)

# Lazy GPIO import — only available on Pi
_gpio = None


def _get_gpio():
    global _gpio
    if _gpio is None and not CONFIG.gpio.mock:
        import RPi.GPIO as GPIO
        _gpio = GPIO
    return _gpio


# --- LED color definitions (R, G, B PWM duty cycle 0-100) ---
LED_COLORS = {
    "off":            (0,   0,   0),
    "green":          (0,   100, 0),
    "red":            (100, 0,   0),
    "blue":           (0,   0,   100),
    "yellow":         (100, 100, 0),
    "orange":         (100, 40,  0),
    "purple":         (60,  0,   100),
    "white":          (100, 100, 100),
    "cyan":           (0,   100, 100),
}

# Per-zone LED GPIO pin triplets (R, G, B)
# Using single-color LEDs mapped to single GPIO pins in current hardware
_LED_PINS: dict[str, int] = {}
_PWM_HANDLES: dict[str, object] = {}
_relay_states: dict[str, bool] = {}
_led_colors: dict[str, str] = {}

_lock = asyncio.Lock()


async def initialize() -> None:
    """Set up GPIO pins for relays and LEDs. Safe to call multiple times."""
    global _relay_states, _led_colors
    GPIO = _get_gpio()
    _relay_states = {name: False for name in CONFIG.gpio.relays}
    _led_colors = {name: "off" for name in ["system", *CONFIG.gpio.relays.keys()]}

    if CONFIG.gpio.mock:
        log.info("GPIO mock mode — no hardware access")
        return

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    # Set up relay pins as output, default LOW (off)
    for name, pin in CONFIG.gpio.relays.items():
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.LOW)
        log.info(f"Relay pin {pin} ({name}) initialized LOW")

    # Set up LED pins as output
    for name, pin in CONFIG.gpio.leds.items():
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.LOW)

    log.info("GPIO initialized")


async def set_relay(zone_name: str, on: bool) -> None:
    """Turn a relay on or off. Thread-safe via asyncio lock."""
    async with _lock:
        pin = CONFIG.gpio.relays.get(zone_name)
        if pin is None:
            raise ValueError(f"Unknown zone: {zone_name}")

        _relay_states[zone_name] = on
        state_str = "ON" if on else "OFF"

        if CONFIG.gpio.mock:
            log.info(f"[MOCK] Relay {zone_name} (GPIO {pin}) -> {state_str}")
            return

        GPIO = _get_gpio()
        GPIO.output(pin, GPIO.HIGH if on else GPIO.LOW)
        log.info(f"Relay {zone_name} (GPIO {pin}) -> {state_str}")


async def turn_off_all() -> None:
    """Emergency stop — turn off all relays immediately."""
    for zone_name in CONFIG.gpio.relays:
        await set_relay(zone_name, False)
    await set_led("system", "red")
    log.warning("All relays turned OFF (emergency stop)")


async def set_led(zone_name: str, color: str) -> None:
    """Set an LED color for a zone. No-op in mock mode."""
    _led_colors[zone_name] = color
    if CONFIG.gpio.mock:
        log.debug(f"[MOCK] LED {zone_name} -> {color}")
        return

    GPIO = _get_gpio()
    pin = CONFIG.gpio.leds.get(zone_name)
    if pin is None:
        return

    # Single-color LED: on for any non-off color
    is_on = color != "off"
    GPIO.output(pin, GPIO.HIGH if is_on else GPIO.LOW)


def get_relay_states() -> dict[str, bool]:
    return dict(_relay_states)


def get_led_colors() -> dict[str, str]:
    return dict(_led_colors)


async def cleanup() -> None:
    """Clean up GPIO on shutdown."""
    if CONFIG.gpio.mock:
        return
    try:
        GPIO = _get_gpio()
        GPIO.cleanup()
        log.info("GPIO cleanup complete")
    except Exception as e:
        log.error(f"GPIO cleanup error: {e}")
