#!/usr/bin/env python3
"""
generate_demo_trace.py

Runs the canonical predator encounter through ENGINE-RECORDED (MaleCNS v1.0, 166,700 neurons).
Generates public/traces/canonical_demo.json for byte-for-byte deterministic replay.
"""

import json
import math
import os
import numpy as np
from flybrain import FlyBrain

def main():
    print("Initializing ENGINE-RECORDED (FlyBrain, MaleCNS v1.0)...")
    brain = FlyBrain(device="cpu")
    print(f"Loaded connectome: {brain.n} neurons, {len(brain.indices)} synapses.")

    # Cell populations
    left_loom = brain.cells(["LC4", "LPLC2"], side="L")
    right_loom = brain.cells(["LC4", "LPLC2"], side="R")
    giant_fiber_l = brain.cells(["DNp01"], side="L")
    giant_fiber_r = brain.cells(["DNp01"], side="R")
    giant_fiber = np.union1d(giant_fiber_l, giant_fiber_r)

    print(f"Identified populations: left_loom={len(left_loom)}, right_loom={len(right_loom)}, giant_fiber={len(giant_fiber)}")

    dt = float(brain.dt) # 0.02s
    total_steps = 600    # 12.0 seconds
    R = 45.0             # predator radius px

    # Arena geometry
    arena_w, arena_h = 800, 600
    fly_x, fly_y = 400.0, 300.0
    fly_heading = 0.0    # facing right
    fly_vel_x, fly_vel_y = 0.0, 0.0
    is_flying = False

    samples = []
    first_jump_latency_ms = None
    threat_start_step = 100 # 2.0s into simulation
    first_jump_step = None

    # Canonical trajectory: predator circles cautiously, then lunges at t = 2.0s
    for step in range(total_steps):
        t = round(step * dt, 3)

        if step < threat_start_step:
            # Stalking circle phase
            angle = (step / threat_start_step) * math.pi
            pred_x = fly_x - 280 * math.cos(angle)
            pred_y = fly_y - 200 * math.sin(angle)
            threat_active = False
        else:
            # Accelerated looming lunge phase
            progress = min(1.0, (step - threat_start_step) / 100.0)
            # Lunge toward the initial fly position
            start_x = fly_x - 280
            start_y = fly_y
            target_x = 400.0
            target_y = 300.0
            pred_x = start_x + (target_x - start_x) * (progress ** 1.8)
            pred_y = start_y + (target_y - start_y) * (progress ** 1.8)
            threat_active = True

        # Distance to predator
        dist = math.hypot(pred_x - fly_x, pred_y - fly_y)
        eff_dist = max(R * 0.75, dist)
        theta = 2.0 * math.atan(R / eff_dist)

        # Retinotopic bearing
        world_angle = math.atan2(pred_y - fly_y, pred_x - fly_x)
        bearing = world_angle - fly_heading
        while bearing > math.pi: bearing -= 2 * math.pi
        while bearing < -math.pi: bearing += 2 * math.pi

        # Looming stimulus injection
        inject_list = []
        loom_intensity = 0.0
        if threat_active and dist < 320:
            loom_intensity = min(1.0, theta * 0.9)
            # Bearing positive = left visual field, negative = right
            if bearing > 0:
                inject_list.append((left_loom, float(loom_intensity * 0.85)))
                inject_list.append((right_loom, float(loom_intensity * 0.25)))
            else:
                inject_list.append((right_loom, float(loom_intensity * 0.85)))
                inject_list.append((left_loom, float(loom_intensity * 0.25)))

        # Step connectome
        fired = brain.step(inject=inject_list)
        fired_set = set(fired)
        gf_fired = bool(set(giant_fiber) & fired_set)

        if gf_fired and first_jump_step is None:
            first_jump_step = step
            first_jump_latency_ms = round((step - threat_start_step) * dt * 1000)
            is_flying = True
            # Explosive escape takeoff directed opposite to predator
            escape_angle = world_angle + math.pi + 0.25
            fly_vel_x = math.cos(escape_angle) * 14.0
            fly_vel_y = math.sin(escape_angle) * 14.0

        # Update fly kinematics
        if is_flying:
            fly_x += fly_vel_x
            fly_y += fly_vel_y
            fly_vel_x *= 0.94
            fly_vel_y *= 0.94
            fly_heading = math.atan2(fly_vel_y, fly_vel_x)
        else:
            # Idle gentle wandering
            fly_x += math.cos(fly_heading) * 0.3
            fly_y += math.sin(fly_heading) * 0.3
            fly_heading += 0.01

        # Keep fly in arena
        fly_x = max(40.0, min(arena_w - 40.0, fly_x))
        fly_y = max(40.0, min(arena_h - 40.0, fly_y))

        samples.append({
            "step": step,
            "t": t,
            "mouseX": round(pred_x, 1),
            "mouseY": round(pred_y, 1),
            "flyX": round(fly_x, 1),
            "flyY": round(fly_y, 1),
            "flyHeading": round(fly_heading, 3),
            "isFlying": is_flying,
            "threatActive": threat_active,
            "dist": round(dist, 1),
            "theta": round(theta, 3),
            "firedCount": len(fired),
            "giantFiberFired": gf_fired,
        })

    trace_data = {
        "version": 1,
        "engine": "RECORDED",
        "dataset": "MaleCNS v1.0",
        "neuronCount": 166700,
        "totalEdges": 25582938,
        "citation": "Berg et al. Cell (2026)",
        "durationS": round(total_steps * dt, 2),
        "dtS": dt,
        "summary": {
            "escaped": is_flying,
            "firstJumpLatencyMs": first_jump_latency_ms,
            "totalSpikes": sum(s["firedCount"] for s in samples),
            "caught": not is_flying,
        },
        "samples": samples
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "traces", "canonical_demo.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(trace_data, f, indent=2)

    print(f"Generated {out_path} ({len(samples)} steps, GF fired at {first_jump_latency_ms} ms)")

if __name__ == "__main__":
    main()
