"""
MQTT client — publishes system status and subscribes to sensor data.
Uses Paho v2 async-compatible wrapper.
Stores incoming sensor readings in the database for API access.
"""
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Optional

import paho.mqtt.client as mqtt_client

from src.config import CONFIG
from src import database, state

log = logging.getLogger(__name__)

_client: Optional[mqtt_client.Client] = None

# Latest sensor readings cached in memory for low-latency API responses
_latest: dict[str, dict] = {}

SENSOR_TOPICS = [
    "sensors/environment",
    "sensors/sets",
    "sensors/plant",
    "sensors/soil",
    "status/system",
]


def get_latest(topic: str) -> Optional[dict]:
    return _latest.get(topic)


def _on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log.info("MQTT connected")
        for topic in SENSOR_TOPICS:
            client.subscribe(topic, qos=0)
            log.debug(f"Subscribed to {topic}")
    else:
        log.error(f"MQTT connection failed: reason_code={reason_code}")


def _on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        topic = msg.topic
        _latest[topic] = payload
        # Fire-and-forget DB store via asyncio
        loop = userdata.get("loop") if userdata else None
        if loop and not loop.is_closed():
            asyncio.run_coroutine_threadsafe(
                database.store_sensor_reading(topic, payload), loop
            )
    except Exception as e:
        log.warning(f"MQTT message parse error on {msg.topic}: {e}")


def _on_disconnect(client, userdata, disconnect_flags, reason_code, properties=None):
    log.warning(f"MQTT disconnected: reason_code={reason_code}")


def setup_mqtt(loop: asyncio.AbstractEventLoop) -> mqtt_client.Client:
    global _client
    client = mqtt_client.Client(
        client_id=CONFIG.mqtt.client_id,
        callback_api_version=mqtt_client.CallbackAPIVersion.VERSION2,
        userdata={"loop": loop},
    )
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.on_disconnect = _on_disconnect

    try:
        client.connect(CONFIG.mqtt.broker_host, CONFIG.mqtt.broker_port, keepalive=60)
        client.loop_start()
        log.info(f"MQTT connecting to {CONFIG.mqtt.broker_host}:{CONFIG.mqtt.broker_port}")
    except Exception as e:
        log.error(f"MQTT connect failed: {e} — will retry automatically")

    _client = client
    return client


def publish_status(payload: dict) -> None:
    """Publish current watering status to status/watering."""
    if _client is None:
        return
    try:
        envelope = {
            "device": CONFIG.device_id,
            "timestamp": datetime.now().isoformat(),
            "seq": int(time.time()),
            "data": payload,
        }
        _client.publish("status/watering", json.dumps(envelope), qos=0, retain=True)
    except Exception as e:
        log.warning(f"MQTT publish error: {e}")


def publish_heartbeat(metrics: dict) -> None:
    """Publish heartbeat to sensors/heartbeat."""
    if _client is None:
        return
    try:
        envelope = {
            "device": CONFIG.device_id,
            "timestamp": datetime.now().isoformat(),
            "data": metrics,
        }
        _client.publish("sensors/heartbeat", json.dumps(envelope), qos=1, retain=True)
    except Exception as e:
        log.warning(f"MQTT heartbeat error: {e}")


async def status_publisher_task(get_status_fn) -> None:
    """Background task — publishes status/watering every 2 seconds."""
    while True:
        try:
            payload = get_status_fn()
            publish_status(payload)
        except Exception as e:
            log.warning(f"Status publish error: {e}")
        await asyncio.sleep(2)


def stop_mqtt() -> None:
    if _client:
        _client.loop_stop()
        _client.disconnect()
