import easyocr

reader = easyocr.Reader(['en'])

def extract_text(frame):
    results = reader.readtext(frame)
    texts = [res[1] for res in results]
    return texts