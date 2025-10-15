# ai_video_analysis_model.py
"""
AI/ML Video Analysis - NSG Project
----------------------------------
This script provides the main model logic for detecting anomalies,
violence, and weapons in surveillance video using pretrained models
(YOLOv8, FaceNet, DETR, etc.).
"""

import os
import cv2
import json
import torch
import numpy as np
from collections import deque
from datetime import datetime
from facenet_pytorch import MTCNN, InceptionResnetV1
from ultralytics import YOLO
from transformers import DetrImageProcessor, DetrForObjectDetection
from scipy.spatial.distance import cosine
import warnings

warnings.filterwarnings("ignore")

# =============== CONFIG ==================
YOLO_CONF = 0.5
DETR_CONF = 0.4
FIGHT_CONF = 0.3
WATCHLIST_DIR = "./nsg_watchlist"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🔧 Using device: {device}")
# ==========================================

# ========== MODEL INITIALIZATION ==========
print("🐙 Loading pretrained models...")

mtcnn = MTCNN(device=device)
facenet = InceptionResnetV1(pretrained="vggface2").eval().to(device)
yolo_general = YOLO("yolov8s.pt")
yolo_fight = YOLO("yolov8m.pt")
wp = DetrImageProcessor.from_pretrained("NabilaLM/detr-weapons-detection_40ep")
wm = DetrForObjectDetection.from_pretrained("NabilaLM/detr-weapons-detection_40ep").eval().to(device)

# Load watchlist embeddings if available
watchlist = {}
db_file = f"{WATCHLIST_DIR}/nsg_watchlist_database.json"
if os.path.exists(db_file):
    data = json.load(open(db_file))
    watchlist = {n: np.array(v["embedding"]) for n, v in data.items()}
    print(f"📋 Loaded {len(watchlist)} watchlist entries")
# ==========================================


def detect_faces(frame):
    """Detect faces safely using MTCNN."""
    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = mtcnn(rgb)
        if faces is None:
            return []
        return faces if isinstance(faces, list) else [faces]
    except Exception:
        return []


def analyze_video(video_path: str, output_path: str = "output.mp4"):
    """Analyze video for anomalies and generate annotated output."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Video not found: {video_path}")

    width, height = int(cap.get(3)), int(cap.get(4))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
    frame_idx, anomalies = 0, []

    print(f"📹 Analyzing: {video_path} ({width}x{height} @ {fps}fps)")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1

        # YOLO detection
        results = yolo_general(frame, verbose=False)
        person_count = sum(1 for r in results if "person" in r.names.values())

        # Weapon detection (DETR)
        try:
            inputs = wp(images=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), return_tensors="pt").to(device)
            outputs = wm(**inputs)
            post = wp.post_process_object_detection(outputs, DETR_CONF, torch.tensor([frame.shape[:2]]))[0]
            weapon_conf = max(post["scores"], default=torch.tensor(0.0)).item() if len(post["scores"]) > 0 else 0.0
        except Exception:
            weapon_conf = 0.0

        # Watchlist face match
        faces = detect_faces(frame)
        suspect_found = False
        for face in faces:
            try:
                emb = facenet(face.unsqueeze(0).to(device)).cpu().numpy().flatten()
                for name, db_emb in watchlist.items():
                    sim = 1 - cosine(emb, db_emb)
                    if sim > 0.7:
                        suspect_found = True
                        cv2.putText(frame, f"Suspect: {name} ({sim:.2f})", (10, 40),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            except Exception:
                continue

        # Decision logic
        if weapon_conf > 0.5 or suspect_found:
            anomalies.append((frame_idx / fps, weapon_conf))
            cv2.putText(frame, "🚨 ANOMALY DETECTED!", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        else:
            cv2.putText(frame, f"Normal | People: {person_count}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        out.write(frame)

    cap.release()
    out.release()
    print(f"✅ Processing complete. Output saved to: {output_path}")

    return {
        "video": video_path,
        "output": output_path,
        "anomalies_detected": len(anomalies),
        "timestamps": [t for t, _ in anomalies]
    }


if __name__ == "__main__":
    video_path = "test_video.mp4"
    if os.path.exists(video_path):
        result = analyze_video(video_path)
        print(json.dumps(result, indent=2))
    else:
        print("⚠️ No input video found. Place your test video in the same folder.")
