import urllib.request
import json

def test_neon_api():
    print("--- 1. Testing Health Endpoint ---")
    with urllib.request.urlopen("http://127.0.0.1:8000/health") as resp:
        print("Health status:", resp.read().decode())

    print("\n--- 2. Testing Authentication against Neon PostgreSQL ---")
    login_payload = json.dumps({"email": "admin@ayursutra.com", "password": "Admin@123"}).encode("utf-8")
    login_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        tokens = json.loads(resp.read().decode())
        token = tokens["access_token"]
        print("Authenticated successfully! Received JWT.")

    print("\n--- 3. Querying Patients from Neon Cloud Database ---")
    pat_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/patients/",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(pat_req) as resp:
        patients = json.loads(resp.read().decode())
        print(f"Retrieved {len(patients)} patients: {[p['first_name'] + ' ' + p['last_name'] for p in patients]}")

    print("\n--- 4. Querying Rooms from Neon Cloud Database ---")
    room_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/rooms/",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(room_req) as resp:
        rooms = json.loads(resp.read().decode())
        print(f"Retrieved {len(rooms)} therapy rooms: {[r['name'] for r in rooms]}")

    print("\n--- 5. Querying Staff from Neon Cloud Database ---")
    staff_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/staff/",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(staff_req) as resp:
        staff = json.loads(resp.read().decode())
        print(f"Retrieved {len(staff)} staff members: {[s['first_name'] + ' ' + s['last_name'] for s in staff]}")

    print("\n--- 6. Querying Therapy Sessions from Neon Cloud Database ---")
    sess_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/scheduling/sessions",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(sess_req) as resp:
        sessions = json.loads(resp.read().decode())
        print(f"Retrieved {len(sessions)} scheduled therapy sessions from Neon.")

    print("\n>>> ALL NEON POSTGRESQL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_neon_api()
