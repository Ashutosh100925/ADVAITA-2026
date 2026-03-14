import sys
import json
import base64
import tempfile
import cv2
import numpy as np

def main():
    try:
        b64_data = sys.stdin.read().strip()

        if "," in b64_data:
            b64_data = b64_data.split(",")[1]

        img_data = base64.b64decode(b64_data)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            print(json.dumps({
                "verified": False,
                "confidence": 0,
                "message": "Invalid image"
            }))
            return

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60)
        )

        if len(faces) > 0:
            print(json.dumps({
                "verified": True,
                "confidence": 0.85,
                "message": "Face detected"
            }))
        else:
            print(json.dumps({
                "verified": False,
                "confidence": 0.2,
                "message": "No face detected"
            }))

    except Exception as e:
        print(json.dumps({
            "verified": False,
            "confidence": 0,
            "message": f"Error: {str(e)}"
        }))

if __name__ == "__main__":
    main()