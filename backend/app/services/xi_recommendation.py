"""
XIRecommendationEngine (section 18): given a pool of available players,
recommend the strongest Playing XI using actual rating/performance data —
and explain the pick, not just output names (section 18: "Why this XI?").

Selection rule (documented so it's auditable, not a black box):
  1. Best-rated wicketkeeper fills the keeper slot.
  2. Up to 2 best all-rounders are taken next (they cover both batting
     depth and bowling overs, which is exactly why a captain values them).
  3. Specialist bowlers fill remaining bowling-option slots up to a target
     of 5 total bowling options (all-rounders count toward this).
  4. Specialist batters fill whatever's left, ranked by current_rating.
  5. If a role is short (e.g. only 3 real bowlers available), that's
     surfaced explicitly in the explanation rather than silently working
     around it.
"""
from __future__ import annotations
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.org import Player
from app.models.enums import PlayingRole

TARGET_BOWLING_OPTIONS = 5
XI_SIZE = 11
MAX_ALL_ROUNDERS_PRIORITIZED = 2


@dataclass
class XISlot:
    player_id: int
    full_name: str
    playing_role: str
    current_rating: float
    reason: str


@dataclass
class XIRecommendation:
    slots: list[XISlot] = field(default_factory=list)
    bench: list[XISlot] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    summary: str = ""


class XIRecommendationEngine:
    def __init__(self, db: Session):
        self.db = db

    def recommend(self, available_player_ids: list[int]) -> XIRecommendation:
        players = (
            self.db.query(Player)
            .filter(Player.id.in_(available_player_ids), Player.is_deleted.is_(False))
            .all()
        )
        warnings: list[str] = []

        keepers = sorted([p for p in players if p.playing_role == PlayingRole.WICKETKEEPER],
                          key=lambda p: -p.current_rating)
        all_rounders = sorted([p for p in players if p.playing_role == PlayingRole.ALL_ROUNDER],
                               key=lambda p: -p.current_rating)
        bowlers = sorted([p for p in players if p.playing_role == PlayingRole.BOWLER],
                          key=lambda p: -p.current_rating)
        batters = sorted([p for p in players if p.playing_role == PlayingRole.BATTER],
                          key=lambda p: -p.current_rating)

        selected: list[XISlot] = []
        selected_ids: set[int] = set()

        # 1. Wicketkeeper
        if keepers:
            k = keepers[0]
            selected.append(XISlot(k.id, k.full_name, "wicketkeeper", k.current_rating,
                                    f"Highest-rated available wicketkeeper (rating {k.current_rating})"))
            selected_ids.add(k.id)
        else:
            warnings.append("No specialist wicketkeeper available — a part-time keeper will be needed.")

        # 2. Best all-rounders (up to cap)
        chosen_ar = all_rounders[:MAX_ALL_ROUNDERS_PRIORITIZED]
        for p in chosen_ar:
            selected.append(XISlot(p.id, p.full_name, "all_rounder", p.current_rating,
                                    f"Top all-rounder — covers both batting depth and bowling overs (rating {p.current_rating})"))
            selected_ids.add(p.id)

        bowling_options_so_far = len(chosen_ar)

        # 3. Specialist bowlers to reach the bowling-options target
        needed_bowlers = max(0, TARGET_BOWLING_OPTIONS - bowling_options_so_far)
        chosen_bowlers = bowlers[:needed_bowlers]
        for p in chosen_bowlers:
            selected.append(XISlot(p.id, p.full_name, "bowler", p.current_rating,
                                    f"Specialist bowler — fills bowling-options quota (rating {p.current_rating})"))
            selected_ids.add(p.id)
        bowling_options_so_far += len(chosen_bowlers)

        if bowling_options_so_far < TARGET_BOWLING_OPTIONS:
            # Pull in remaining all-rounders (beyond the initial cap) before resorting to warnings
            extra_ar = [p for p in all_rounders if p.id not in selected_ids]
            shortfall = TARGET_BOWLING_OPTIONS - bowling_options_so_far
            for p in extra_ar[:shortfall]:
                selected.append(XISlot(p.id, p.full_name, "all_rounder", p.current_rating,
                                        f"Additional all-rounder — squad is short on specialist bowlers (rating {p.current_rating})"))
                selected_ids.add(p.id)
                bowling_options_so_far += 1
            if bowling_options_so_far < TARGET_BOWLING_OPTIONS:
                warnings.append(
                    f"Only {bowling_options_so_far} bowling options available "
                    f"(target {TARGET_BOWLING_OPTIONS}) — overs will need to be shared more widely."
                )

        # 4. Fill remaining slots with best available batters (then anyone left, if desperate)
        remaining_slots = XI_SIZE - len(selected)
        chosen_batters = [p for p in batters if p.id not in selected_ids][:remaining_slots]
        for p in chosen_batters:
            selected.append(XISlot(p.id, p.full_name, "batter", p.current_rating,
                                    f"Top-rated available batter (rating {p.current_rating})"))
            selected_ids.add(p.id)

        remaining_slots = XI_SIZE - len(selected)
        if remaining_slots > 0:
            leftover_pool = sorted(
                [p for p in players if p.id not in selected_ids], key=lambda p: -p.current_rating
            )
            for p in leftover_pool[:remaining_slots]:
                selected.append(XISlot(p.id, p.full_name, p.playing_role.value, p.current_rating,
                                        "Filled remaining slot from best available (squad depth is thin)"))
                selected_ids.add(p.id)
            if len(selected) < XI_SIZE:
                warnings.append(f"Only {len(selected)} eligible players available — squad is short of a full XI.")

        bench = sorted(
            [XISlot(p.id, p.full_name, p.playing_role.value, p.current_rating, "Bench / substitute")
             for p in players if p.id not in selected_ids],
            key=lambda s: -s.current_rating,
        )

        summary = (
            f"Recommended XI: {bowling_options_so_far} bowling option(s), "
            f"{sum(1 for s in selected if s.playing_role == 'batter')} specialist batters, "
            f"{'1' if keepers else '0'} keeper."
        )

        return XIRecommendation(slots=selected, bench=bench, warnings=warnings, summary=summary)
