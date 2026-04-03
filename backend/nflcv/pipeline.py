from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import supervision as sv

from nflcv.config import NFLCVSettings
from nflcv.constants import FIELD_HEIGHT, FIELD_MAP, FIELD_WIDTH, KEYPOINT_NAMES
from nflcv.model_loader import load_models


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _to_payload(result: Any) -> Any:
    if hasattr(result, "model_dump"):
        return result.model_dump()
    if hasattr(result, "dict"):
        return result.dict()
    return result


def _extract_boxes(result: Any) -> list[dict[str, Any]]:
    boxes = []
    if result is None:
        return boxes
    payload = _to_payload(result)
    if isinstance(payload, dict) and "predictions" in payload:
        for prediction in payload.get("predictions", []):
            if all(key in prediction for key in ("x", "y", "width", "height")):
                x = float(prediction["x"])
                y = float(prediction["y"])
                w = float(prediction["width"])
                h = float(prediction["height"])
                class_id = int(prediction.get("class_id", -1))
                class_name = str(prediction.get("class_name") or prediction.get("class") or class_id)
                confidence = float(prediction.get("confidence", 0.0))
                boxes.append(
                    {
                        "bbox": [x - w / 2, y - h / 2, x + w / 2, y + h / 2],
                        "class_id": class_id,
                        "class_name": class_name,
                        "confidence": confidence,
                    }
                )
        return boxes

    detections = sv.Detections.from_inference(result)
    if detections is None or detections.xyxy is None:
        return boxes
    for idx, bbox in enumerate(detections.xyxy):
        class_id = int(detections.class_id[idx]) if detections.class_id is not None else -1
        confidence = float(detections.confidence[idx]) if detections.confidence is not None else 0.0
        boxes.append(
            {
                "bbox": [float(v) for v in bbox],
                "class_id": class_id,
                "class_name": str(class_id),
                "confidence": confidence,
            }
        )
    return boxes


def _extract_keypoints(result: Any, confidence_threshold: float) -> list[tuple[np.ndarray, str]]:
    if result is None:
        return []
    payload = _to_payload(result)
    if isinstance(payload, dict) and "predictions" in payload:
        output = []
        for prediction in payload.get("predictions", []):
            if "keypoints" in prediction:
                for kp in prediction.get("keypoints", []):
                    label = str(kp.get("class") or kp.get("class_name") or "")
                    conf = float(kp.get("confidence", 0.0))
                    if label and conf >= confidence_threshold:
                        output.append((np.array([kp.get("x", 0.0), kp.get("y", 0.0)]), label))
            elif all(key in prediction for key in ("x", "y", "confidence", "class")):
                label = str(prediction.get("class", ""))
                conf = float(prediction.get("confidence", 0.0))
                if label and conf >= confidence_threshold:
                    output.append((np.array([prediction["x"], prediction["y"]]), label))
        return output

    keypoints = sv.KeyPoints.from_inference(result)
    if keypoints is None or keypoints.xy is None or keypoints.confidence is None:
        return []
    keypoints_xy = keypoints.xy
    keypoints_conf = keypoints.confidence
    if len(keypoints_xy) == 0:
        return []
    points = keypoints_xy[0]
    confs = keypoints_conf[0]
    output = []
    for idx, conf in enumerate(confs):
        if idx >= len(KEYPOINT_NAMES):
            break
        if float(conf) >= confidence_threshold:
            output.append((points[idx], KEYPOINT_NAMES[idx]))
    return output


def _compute_homography(frame: np.ndarray, keypoint_model: Any, settings: NFLCVSettings):
    if keypoint_model is None:
        return None
    result = keypoint_model.infer(frame)[0]
    image_points_and_labels = _extract_keypoints(result, settings.keypoint_confidence)
    if len(image_points_and_labels) < 4:
        return None
    image_points = [tuple(point) for point, _ in image_points_and_labels]
    image_labels = [label for _, label in image_points_and_labels]
    map_points = [FIELD_MAP[label] for label in image_labels if label in FIELD_MAP]
    if len(map_points) < 4:
        return None
    matrix, _ = cv2.findHomography(
        np.array(image_points, dtype="float32"),
        np.array(map_points, dtype="float32"),
        cv2.RANSAC,
    )
    return matrix


def _map_to_field(x: float, y: float, matrix: np.ndarray) -> tuple[float, float] | None:
    if matrix is None:
        return None
    point = np.array([[[x, y]]], dtype="float32")
    mapped = cv2.perspectiveTransform(point, matrix)
    field_x, field_y = mapped[0][0]
    return float(FIELD_WIDTH - field_x), float(field_y)


def _snap_score(result: Any) -> float | None:
    if result is None:
        return None
    payload = _to_payload(result)
    if isinstance(payload, dict) and "predictions" in payload:
        confidences = []
        for prediction in payload.get("predictions", []):
            if "confidence" in prediction:
                confidences.append(float(prediction["confidence"]))
        if confidences:
            return max(confidences)
    try:
        detections = sv.Detections.from_inference(result)
        if detections is not None and detections.confidence is not None:
            if len(detections.confidence) > 0:
                return float(detections.confidence.max())
    except Exception:
        return None
    return None


def process_video(input_path: str, output_dir: str, settings: NFLCVSettings) -> str:
    output_root = Path(output_dir)
    _ensure_dir(output_root)

    models = load_models(settings)
    player_model = models["player"]
    snap_model = models["snap"]
    keypoint_model = models["keypoint"]

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video: {input_path}")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frames = []
    homography_matrix = None

    for frame_idx in range(frame_count):
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % settings.homography_interval == 0:
            updated_matrix = _compute_homography(frame, keypoint_model, settings)
            if updated_matrix is not None:
                homography_matrix = updated_matrix

        detections = []
        if player_model is not None:
            result = player_model.infer(frame)[0]
            detections.extend(_extract_boxes(result))

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            mapped = _map_to_field((x1 + x2) / 2.0, y2, homography_matrix)
            det["field_position"] = mapped

        snap_result = None
        if snap_model is not None:
            snap_result = snap_model.infer(frame)[0]
        snap_score = _snap_score(snap_result)

        frames.append(
            {
                "frame_index": frame_idx,
                "timestamp_ms": int((frame_idx / fps) * 1000),
                "detections": detections,
                "snap_score": snap_score,
                "is_post_snap": snap_score is not None and snap_score >= settings.snap_threshold,
            }
        )

    cap.release()

    results = {
        "video": {
            "fps": fps,
            "frame_count": frame_count,
            "width": width,
            "height": height,
        },
        "field": {
            "width": FIELD_WIDTH,
            "height": FIELD_HEIGHT,
        },
        "frames": frames,
    }

    results_path = output_root / "results.json"
    with results_path.open("w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=2)

    return str(results_path)
