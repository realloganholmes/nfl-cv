import argparse
from pathlib import Path

from nflcv.config import get_settings
from nflcv.pipeline import process_video


def main() -> int:
    parser = argparse.ArgumentParser(description="Process football play video.")
    parser.add_argument("input", help="Path to input video file")
    parser.add_argument("output", help="Output directory for results")
    args = parser.parse_args()

    settings = get_settings()
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    process_video(args.input, str(output_dir), settings)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
