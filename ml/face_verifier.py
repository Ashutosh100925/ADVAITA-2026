from deepface import DeepFace

def verify_face(captured_img, stored_img):
    result = DeepFace.verify(captured_img, stored_img)
    return result["verified"]