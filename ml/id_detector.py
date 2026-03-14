import cv2
import numpy as np

def detect_id(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Improve contrast
    gray = cv2.equalizeHist(gray)

    # Adaptive threshold
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11, 2
    )

    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    h, w = frame.shape[:2]
    frame_area = h * w

    for cnt in contours:
        area = cv2.contourArea(cnt)

        # ID should occupy decent part of frame
        if area > frame_area * 0.2:
            return True

    return False