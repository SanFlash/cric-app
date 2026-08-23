import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    CAPTAIN = "captain"
    UMPIRE = "umpire"
    PLAYER = "player"
    VIEWER = "viewer"


class PlayingRole(str, enum.Enum):
    BATTER = "batter"
    BOWLER = "bowler"
    ALL_ROUNDER = "all_rounder"
    WICKETKEEPER = "wicketkeeper"


class BattingStyle(str, enum.Enum):
    RIGHT_HAND = "right_hand"
    LEFT_HAND = "left_hand"


class BowlingStyle(str, enum.Enum):
    RIGHT_ARM_FAST = "right_arm_fast"
    RIGHT_ARM_MEDIUM = "right_arm_medium"
    RIGHT_ARM_OFF_SPIN = "right_arm_off_spin"
    RIGHT_ARM_LEG_SPIN = "right_arm_leg_spin"
    LEFT_ARM_FAST = "left_arm_fast"
    LEFT_ARM_MEDIUM = "left_arm_medium"
    LEFT_ARM_ORTHODOX = "left_arm_orthodox"
    LEFT_ARM_CHINAMAN = "left_arm_chinaman"
    NONE = "none"


class PlayerStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    INJURED = "injured"
    UNAVAILABLE = "unavailable"


class MatchStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    POSTPONED = "postponed"


class TossDecision(str, enum.Enum):
    BAT = "bat"
    BOWL = "bowl"


class DeliveryOutcome(str, enum.Enum):
    DOT = "dot"
    ONE = "one"
    TWO = "two"
    THREE = "three"
    FOUR = "four"
    SIX = "six"
    WIDE = "wide"
    NO_BALL = "no_ball"
    BYE = "bye"
    LEG_BYE = "leg_bye"
    WICKET = "wicket"


class DismissalType(str, enum.Enum):
    BOWLED = "bowled"
    CAUGHT = "caught"
    LBW = "lbw"
    RUN_OUT = "run_out"
    STUMPED = "stumped"
    HIT_WICKET = "hit_wicket"
    RETIRED_HURT = "retired_hurt"
    NOT_OUT = "not_out"


class TournamentFormat(str, enum.Enum):
    LEAGUE = "league"
    KNOCKOUT = "knockout"
    GROUP_STAGE = "group_stage"
    ROUND_ROBIN = "round_robin"
