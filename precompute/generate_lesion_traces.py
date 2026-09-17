#!/usr/bin/env python3
"""
generate_lesion_traces.py

Generates Brain Surgery traces comparing:
1. Intact (MaleCNS v1.0, 166,700 neurons)
2. LC4/LPLC2 Visual Pathway Lesion
3. DNp01 Giant Fiber Escape Command Lesion

All runs experience the identical predator trajectory.
Outputs:
- public/traces/brain_surgery_intact.json
- public/traces/brain_surgery_lc4_lesion.json
- public/traces/brain_surgery_dnp01_lesion.json
"""

import json
import math
import os
import numpy as np
from flybrain import FlyBrain

def run_simulation(lesion_type="intact"):
    print(f"\n--- Running Brain Surgery simulation: condition='{lesion_type}' ---")
    brain = FlyBrain(device="cpu")

    left_loom = brain.cells(["LC4", "LPLC2"], side="L")
    right_loom = brain.cells(["LC4", "LPLC2"], side="R")
    giant_fiber_l = brain.cells(["DNp01"], side="L")
    giant_fiber_r = brain.cells(["DNp01"], side="R")
    giant_fiber = np.union1d(giant_fiber_l, giant_fiber_r)

    # Apply lesioning (silencing target population)
    silenced_cells = np.array([], dtype=int)
    if lesion_type == "lc4":
        silenced_cells = np.union1d(left_loom, right_loom)
        print(f"Ablating/Silencing visual looming pathway: {len(silenced_cells)} neurons (LC4 + LPLC2)")
    elif lesion_type == "dnp01":
        silenced_cells = giant_fiber
        print(f"Ablating/Silencing Giant Fiber escape command: {len(silenced_cells)} neurons (DNp01)")
    else:
        print("Intact condition: 0 neurons silenced.")

    dt = float(brain.dt) # 0.02s
    total_steps = 500    # 10.0 seconds
    R = 45.0

    arena_w, arena_h = 800, 600
    fly_x, fly_y = 400.0, 300.0
    fly_heading = 0.0
    fly_vel_x, fly_vel_y = 0.0, 0.0
    is_flying = False
    caught = False

    samples = []
    threat_start_step = 100
    first_jump_latency_ms = None
    caught_step = None

    for step in range(total_steps):
        t = round(step * dt, 3)

        if step < threat_start_step:
            angle = (step / threat_start_step) * math.pi
            pred_x = 400.0 - 280 * math.cos(angle)
            pred_y = 300.0 - 200 * math.sin(angle)
            threat_active = False
        else:
            # Looming lunge straight toward initial position
            progress = min(1.0, (step - threat_start_step) / 100.0)
            start_x = 120.0
            start_y = 300.0
            target_x = 400.0
            target_y = 300.0
            pred_x = start_x + (target_x - start_x) * (progress ** 1.8)
            pred_y = start_y + (target_y - start_y) * (progress ** 1.8)
            threat_active = True

        dist = math.hypot(pred_x - fly_x, pred_y - fly_y)
        eff_dist = max(R * 0.75, dist)
        theta = 2.0 * math.atan(R / eff_dist)

        world_angle = math.atan2(pred_y - fly_y, pred_x - fly_x)
        bearing = world_angle - fly_heading
        while bearing > math.pi: bearing -= 2 * math.pi
        while bearing < -math.pi: bearing += 2 * math.pi

        # Check if predator caught fly
        if threat_active and dist <= R and not is_flying and not caught:
            caught = True
            caught_step = step

        # Visual looming stimulus injection
        inject_list = []
        if threat_active and dist < 320 and not caught:
            loom_intensity = min(1.0, theta * 0.9)
            if bearing > 0:
                inject_list.append((left_loom, float(loom_intensity * 0.85)))
                inject_list.append((right_loom, float(loom_intensity * 0.25)))
            else:
                inject_list.append((right_loom, float(loom_intensity * 0.85)))
                inject_list.append((left_loom, float(loom_intensity * 0.25)))

        # Enforce silencing: keep silenced neurons clamped at 0 voltage
        if len(silenced_cells) > 0:
            brain.v[silenced_cells] = -100.0

        fired = brain.step(inject=inject_list)

        # Ensure silenced neurons never register in fired set
        if len(silenced_cells) > 0:
            brain.v[silenced_cells] = -100.0
            fired = np.setdiff1d(fired, silenced_cells)

        fired_set = set(fired)
        gf_fired = bool(set(giant_fiber) & fired_set)

        if gf_fired and not is_flying and not caught:
            first_jump_latency_ms = round((step - threat_start_step) * dt * 1000)
            is_flying = True
            escape_angle = world_angle + math.pi + 0.2
            fly_vel_x = math.cos(escape_angle) * 14.0
            fly_vel_y = math.sin(escape_angle) * 14.0

        if not caught:
            if is_flying:
                fly_x += fly_vel_x
                fly_y += fly_vel_y
                fly_vel_x *= 0.94
                fly_vel_y *= 0.94
                fly_heading = math.atan2(fly_vel_y, fly_vel_x)
            else:
                fly_x += math.cos(fly_heading) * 0.2
                fly_y += math.sin(fly_heading) * 0.2
                fly_heading += 0.01

        samples.append({
            "step": step,
            "t": t,
            "mouseX": round(pred_x, 1),
            "mouseY": round(pred_y, 1),
            "flyX": round(fly_x, 1),
            "flyY": round(fly_y, 1),
            "flyHeading": round(fly_heading, 3),
            "isFlying": is_flying,
            "caught": caught,
            "dist": round(dist, 1),
            "firedCount": len(fired),
            "giantFiberFired": gf_fired,
        })

    return {
        "version": 1,
        "engine": "RECORDED",
        "dataset": "MaleCNS v1.0",
        "neuronCount": 166700,
        "lesionType": lesion_type,
        "lesionedNeuronCount": len(silenced_cells),
        "totalEdges": 25582938,
        "citation": "Berg et al. Cell (2026)",
        "durationS": round(total_steps * dt, 2),
        "dtS": dt,
        "summary": {
            "escaped": is_flying and not caught,
            "caught": caught,
            "caughtTimeS": round(caught_step * dt, 2) if caught_step else None,
            "firstJumpLatencyMs": first_jump_latency_ms,
            "totalSpikes": sum(s["firedCount"] for s in samples),
        },
        "samples": samples
    }

def main():
    traces_dir = os.path.join(os.path.dirname(__file__), "..", "public", "traces")
    os.makedirs(traces_dir, exist_ok=True)

    conditions = [
        ("intact", "brain_surgery_intact.json"),
        ("lc4", "brain_surgery_lc4_lesion.json"),
        ("dnp01", "brain_surgery_dnp01_lesion.json"),
    ]

    for lesion_type, filename in conditions:
        data = run_simulation(lesion_type)
        path = os.path.join(traces_dir, filename)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved {path} -> escaped={data['summary']['escaped']}, caught={data['summary']['caught']}, latency={data['summary']['firstJumpLatencyMs']}")

if __name__ == "__main__":
    main()
