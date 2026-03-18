"""
Migrate the old sprinkler_schedule.json format to the new LawnBot format.
Run once on the Pi: python3 migrate_schedule.py
"""
import json

OLD_FILE = "/home/lds00/sprinkler/sprinkler_schedule.json"
NEW_FILE = "/home/lds00/lawnbot/config/sprinkler_schedule.json"

with open(OLD_FILE) as f:
    old = json.load(f)

# Build sets list from old format
sets = []
for s in old.get("sets", []):
    name = s.get("set_name", "Unknown")
    duration = s.get("seasonallyAdjustedMinutes") or s.get("run_duration_minutes", 10)
    pulse = s.get("pulse_duration_minutes")
    soak = s.get("soak_duration_minutes")
    mode_flag = s.get("mode", False)  # old: True = pulse_soak
    # Misters have no duration set — default 3 min normal
    if name == "Misters":
        sets.append({"name": name, "duration_minutes": 3, "mode": "normal", "enabled": False})
    elif mode_flag and pulse and soak:
        sets.append({
            "name": name,
            "duration_minutes": float(duration),
            "pulse_minutes": float(pulse),
            "soak_minutes": float(soak),
            "mode": "pulse_soak",
            "enabled": True,
        })
    else:
        sets.append({"name": name, "duration_minutes": float(duration), "mode": "normal", "enabled": True})

# Build start_times
start_times = []
for st in old.get("start_times", []):
    start_times.append({
        "time": st["time"],
        "enabled": st.get("isEnabled", True),
        "sets": sets,
    })

# Mist settings — use lowest trigger
mist_settings = {"enabled": False, "trigger_temp_f": 90.0, "duration_seconds": 30, "check_interval_minutes": 30}
mist_temps = old.get("mist", {}).get("temperature_settings", [])
if mist_temps:
    lowest = min(mist_temps, key=lambda x: x["temperature"])
    mist_settings = {
        "enabled": True,
        "trigger_temp_f": float(lowest["temperature"]),
        "duration_seconds": int(float(lowest.get("duration", 0.5)) * 60),
        "check_interval_minutes": int(lowest.get("interval", 30)),
    }

new_schedule = {
    "start_times": start_times,
    "schedule_days": old.get("schedule_days", [True] * 14),
    "mist_settings": mist_settings,
}

with open(NEW_FILE, "w") as f:
    json.dump(new_schedule, f, indent=2)

print("Migration complete!")
print(f"  Start times: {[s['time'] for s in start_times]}")
print(f"  Sets: {[s['name'] for s in sets]}")
print(f"  Mist trigger: {mist_settings['trigger_temp_f']}°F")
print(f"  Watering days: {sum(new_schedule['schedule_days'])}/14")
