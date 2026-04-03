KEYPOINT_NAMES = [
    "goalline",
    "goalline-bottom",
    "10",
    "10-top-hash",
    "10-bottom-hash",
    "10-bottom",
    "20",
    "20-top-hash",
    "20-bottom-hash",
    "20-bottom",
    "30",
    "30-top-hash",
    "30-bottom-hash",
    "30-bottom",
    "40",
    "40-top-hash",
    "40-bottom-hash",
    "40-bottom",
    "50",
    "50-top-hash",
    "50-bottom",
    "back-endzone",
    "endzone-bottom",
    "50-bottom-hash",
    "50-top-sl",
    "50-bottom-sl",
    "40-top-sl",
    "40-bottom-sl",
    "30-top-sl",
    "30-bottom-sl",
    "20-top-sl",
    "20-bottom-sl",
    "10-top-sl",
    "10-bottom-sl",
    "FG-POST",
    "5-top-sl",
    "5-top-hash",
    "5-bottom-hash",
    "5-bottom-sl",
]

SKILL_ID = 4
LB_ID = 2
DB_ID = 1
C_ID = 0
QB_ID = 3

PLAYER_COLOR_DICT = {
    0: (255, 0, 0),
    1: (0, 255, 0),
    2: (0, 0, 255),
    3: (255, 255, 0),
    4: (255, 0, 255),
}

PLAYER_NAME_DICT = {
    0: "C",
    1: "DB",
    2: "LB",
    3: "QB",
    4: "SK",
}

# Field layout
TOP_SL = 0
TOP_NUM = 42
TOP_HASH = 70
BOTTOM_HASH = 90
BOTTOM_NUM = 118
BOTTOM_SL = 160

FG_POST = 80
BACK_ENDZONE = 0
GOALLINE = 30
FIVE = 45
TEN = 60
TWENTY = 90
THIRTY = 120
FORTY = 150
FIFTY = 180

X_PAD = 10
Y_PAD = 10

FIELD_WIDTH = 160
FIELD_HEIGHT = 360

SCALE = 3


def field_tuple(x: int, y: int) -> tuple[int, int]:
    return ((x * SCALE) + X_PAD, (y * SCALE) + Y_PAD)


FIELD_MAP = {
    "10-top-sl": field_tuple(TOP_SL, TEN),
    "10": field_tuple(TOP_NUM, TEN),
    "10-top-hash": field_tuple(TOP_HASH, TEN),
    "10-bottom-hash": field_tuple(BOTTOM_HASH, TEN),
    "10-bottom": field_tuple(BOTTOM_NUM, TEN),
    "10-bottom-sl": field_tuple(BOTTOM_SL, TEN),
    "20-top-sl": field_tuple(TOP_SL, TWENTY),
    "20": field_tuple(TOP_NUM, TWENTY),
    "20-top-hash": field_tuple(TOP_HASH, TWENTY),
    "20-bottom-hash": field_tuple(BOTTOM_HASH, TWENTY),
    "20-bottom": field_tuple(BOTTOM_NUM, TWENTY),
    "20-bottom-sl": field_tuple(BOTTOM_SL, TWENTY),
    "30-top-sl": field_tuple(TOP_SL, THIRTY),
    "30": field_tuple(TOP_NUM, THIRTY),
    "30-top-hash": field_tuple(TOP_HASH, THIRTY),
    "30-bottom-hash": field_tuple(BOTTOM_HASH, THIRTY),
    "30-bottom": field_tuple(BOTTOM_NUM, THIRTY),
    "30-bottom-sl": field_tuple(BOTTOM_SL, THIRTY),
    "40-top-sl": field_tuple(TOP_SL, FORTY),
    "40": field_tuple(TOP_NUM, FORTY),
    "40-top-hash": field_tuple(TOP_HASH, FORTY),
    "40-bottom-hash": field_tuple(BOTTOM_HASH, FORTY),
    "40-bottom": field_tuple(BOTTOM_NUM, FORTY),
    "40-bottom-sl": field_tuple(BOTTOM_SL, FORTY),
    "50-top-sl": field_tuple(TOP_SL, FIFTY),
    "50": field_tuple(TOP_NUM, FIFTY),
    "50-top-hash": field_tuple(TOP_HASH, FIFTY),
    "50-bottom-hash": field_tuple(BOTTOM_HASH, FIFTY),
    "50-bottom": field_tuple(BOTTOM_NUM, FIFTY),
    "50-bottom-sl": field_tuple(BOTTOM_SL, FIFTY),
    "goalline": field_tuple(TOP_SL, GOALLINE),
    "goalline-bottom": field_tuple(BOTTOM_SL, GOALLINE),
    "back-endzone": field_tuple(TOP_SL, BACK_ENDZONE),
    "endzone-bottom": field_tuple(BOTTOM_SL, BACK_ENDZONE),
    "FG-POST": field_tuple(FG_POST, BACK_ENDZONE),
    "5-top-sl": field_tuple(TOP_SL, FIVE),
    "5-top-hash": field_tuple(TOP_HASH, FIVE),
    "5-bottom-hash": field_tuple(BOTTOM_HASH, FIVE),
    "5-bottom-sl": field_tuple(BOTTOM_SL, FIVE),
}
