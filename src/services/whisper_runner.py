 import sys
from whisper import load_model

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: whisper_runner.py <audio_file>", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    model = load_model("tiny.en")  
    result = model.transcribe(audio_path, language="en")
    print(result["text"].strip())
