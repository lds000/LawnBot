import sys
sys.path.insert(0, '/home/lds00/lawnbot')
import os
os.chdir('/home/lds00/lawnbot')

errors = []

try:
    from src.config import CONFIG
    print(f"[OK] Config: device_id={CONFIG.device_id}, gpio_mock={CONFIG.gpio.mock}")
except Exception as e:
    errors.append(f"[FAIL] Config: {e}")

try:
    from src.scheduler import load_schedule, is_watering_day, get_schedule_day_index
    s = load_schedule()
    day = get_schedule_day_index()
    watering = is_watering_day(s)
    print(f"[OK] Scheduler: day_index={day}, watering_day={watering}, start_times={len(s.get('start_times',[]))}")
except Exception as e:
    errors.append(f"[FAIL] Scheduler: {e}")

try:
    from src.models import Schedule, ManualRunRequest, ScheduleUpdateRequest
    print("[OK] Models: Pydantic models load OK")
except Exception as e:
    errors.append(f"[FAIL] Models: {e}")

try:
    from src.state import get_current_run, set_current_run, clear_current_run
    print("[OK] State: state module OK")
except Exception as e:
    errors.append(f"[FAIL] State: {e}")

try:
    from src.gpio_controller import initialize, set_relay, get_relay_states
    print(f"[OK] GPIO: mock_mode={CONFIG.gpio.mock}")
except Exception as e:
    errors.append(f"[FAIL] GPIO: {e}")

try:
    from src import database
    print("[OK] Database: aiosqlite module OK")
except Exception as e:
    errors.append(f"[FAIL] Database: {e}")

try:
    from api import app
    print(f"[OK] FastAPI: app loaded, routes={len(app.routes)}")
except Exception as e:
    errors.append(f"[FAIL] API: {e}")

if errors:
    print("\n--- ERRORS ---")
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print("\nAll checks passed!")
