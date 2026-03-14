import sys
import traceback

print("Testing imports...")
try:
    import cv2
    import numpy as np
    print("OpenCV and Numpy imported.")
except Exception as e:
    print("Failed core libs:")
    traceback.print_exc()

try:
    from ml.id_detector import detect_id
    print("ml.id_detector imported successfully!")
except Exception as e:
    print("Failed to import ml.id_detector:")
    traceback.print_exc()
