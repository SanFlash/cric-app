"""
PredictionEngine implements the Phase 1 "transparent statistical model" the
spec calls for (section 33) — a weighted linear combination of measurable
factors, NOT a black-box ML model. Every number that moves the probability
is named in `factors`, satisfying section 16's explainability requirement.
Deliberately clamped to [5, 95] pre-match and [2, 98] live — section 14:
"Do NOT display predictions as guaranteed outcomes."

Two entry points:
  - compute_pre_match(match_id): team strength, recent form, head-to-head,
    toss — called once before a match starts (or on demand).
  - compute_live(match_id): re-run continuously during the second innings
    chase using required-run-rate vs current-run-rate and wickets in hand,
    anchored to the pre-match baseline so the graph in section 15 is a
    smooth trajectory, not noise. Called after every delivery from the
    scoring route.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.org import Player, Team
from app.models.match import Match, Innings
from app.models.performance import Prediction
from app.models.enums import MatchStatus


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass
class Factor:
    label: str
    direction: str  # "favor_a" | "favor_b" | "neutral"
    weight: float    # magnitude of this factor's contribution, for display/sorting

    def to_dict(self) -> dict:
        return {"factor": self.label, "direction": self.direction, "weight": round(self.weight, 1)}


@dataclass
class PredictionResult:
    team_a_win_pct: float
    team_b_win_pct: float
    context: str
    factors: list[Factor] = field(default_factory=list)

    def factors_payload(self) -> dict:
        return {"items": [f.to_dict() for f in sorted(self.factors, key=lambda f: -f.weight)]}


class PredictionEngine:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    def _team_strength(self, team_id: int) -> float:
        players = self.db.query(Player).filter(Player.team_id == team_id, Player.is_deleted.is_(False)).all()
        rated = [p.current_rating for p in players if p.current_rating > 0]
        return round(sum(rated) / len(rated), 1) if rated else 50.0  # neutral baseline for unrated squads

    def _team_form(self, team_id: int) -> float:
        players = self.db.query(Player).filter(Player.team_id == team_id, Player.is_deleted.is_(False)).all()
        formed = [p.current_form_score for p in players if p.current_form_score > 0]
        return round(sum(formed) / len(formed), 1) if formed else 50.0

    def _head_to_head(self, team_a_id: int, team_b_id: int) -> tuple[float | None, int]:
        """Returns (team_a_win_pct, sample_size) from past completed meetings, or (None, 0) if too few."""
        past = (
            self.db.query(Match)
            .filter(
                Match.status == MatchStatus.COMPLETED,
                ((Match.team_a_id == team_a_id) & (Match.team_b_id == team_b_id)) |
                ((Match.team_a_id == team_b_id) & (Match.team_b_id == team_a_id)),
            )
            .all()
        )
        if len(past) < 2:  # don't draw conclusions from a single prior meeting
            return None, len(past)
        a_wins = sum(1 for m in past if m.winner_team_id == team_a_id)
        return round(a_wins / len(past) * 100, 1), len(past)

    # ------------------------------------------------------------------
    def compute_pre_match(self, match_id: int) -> Prediction:
        match: Match = self.db.get(Match, match_id)
        team_a, team_b = self.db.get(Team, match.team_a_id), self.db.get(Team, match.team_b_id)

        strength_a, strength_b = self._team_strength(team_a.id), self._team_strength(team_b.id)
        form_a, form_b = self._team_form(team_a.id), self._team_form(team_b.id)
        h2h_a_pct, h2h_sample = self._head_to_head(team_a.id, team_b.id)

        factors: list[Factor] = []
        diff = 0.0

        strength_delta = strength_a - strength_b
        diff += strength_delta * 0.35
        if abs(strength_delta) >= 2:
            factors.append(Factor(
                f"{'Stronger' if strength_delta > 0 else 'Weaker'} overall squad rating "
                f"({strength_a} vs {strength_b})",
                "favor_a" if strength_delta > 0 else "favor_b", abs(strength_delta) * 0.35,
            ))

        form_delta = form_a - form_b
        diff += form_delta * 0.30
        if abs(form_delta) >= 2:
            factors.append(Factor(
                f"{'Better' if form_delta > 0 else 'Worse'} recent batting/bowling form",
                "favor_a" if form_delta > 0 else "favor_b", abs(form_delta) * 0.30,
            ))

        if h2h_a_pct is not None:
            h2h_delta = h2h_a_pct - 50
            diff += h2h_delta * 0.20
            if abs(h2h_delta) >= 5:
                factors.append(Factor(
                    f"Historical head-to-head record ({h2h_sample} meetings, Team A won {h2h_a_pct}%)",
                    "favor_a" if h2h_delta > 0 else "favor_b", abs(h2h_delta) * 0.20,
                ))

        if match.toss_winner_team_id:
            toss_bump = 3.0
            diff += toss_bump if match.toss_winner_team_id == team_a.id else -toss_bump
            factors.append(Factor(
                f"Won the toss" + (f" and chose to {match.toss_decision.value}" if match.toss_decision else ""),
                "favor_a" if match.toss_winner_team_id == team_a.id else "favor_b", toss_bump,
            ))

        team_a_pct = round(_clamp(50 + diff, 5, 95), 1)
        result = PredictionResult(team_a_win_pct=team_a_pct, team_b_win_pct=round(100 - team_a_pct, 1),
                                   context="pre_match", factors=factors)
        return self._persist(match_id, result)

    # ------------------------------------------------------------------
    def compute_live(self, match_id: int) -> Prediction | None:
        """Recalculates win probability during the second-innings chase.
        Returns None if the match isn't in a chaseable state yet (still 1st
        innings, or 2nd innings hasn't started) — nothing useful to say."""
        match: Match = self.db.get(Match, match_id)
        innings_list = sorted(match.innings, key=lambda i: i.innings_number)
        if len(innings_list) < 2:
            return None
        second = innings_list[1]
        if second.target is None or second.total_balls == 0:
            return None  # chase hasn't started

        baseline = (
            self.db.query(Prediction)
            .filter(Prediction.match_id == match_id, Prediction.context == "pre_match")
            .order_by(Prediction.computed_at.desc())
            .first()
        )
        chasing_team_id = second.batting_team_id
        baseline_chasing_pct = (
            baseline.team_a_win_pct if baseline and chasing_team_id == match.team_a_id else
            baseline.team_b_win_pct if baseline else 50.0
        )

        max_balls = match.overs_limit * 6
        balls_remaining = max(0, max_balls - second.total_balls)
        runs_remaining = max(0, second.target - second.total_runs)

        factors: list[Factor] = []

        if runs_remaining == 0:
            chasing_pct = 98.0
            factors.append(Factor("Target already reached", "favor_a" if chasing_team_id == match.team_a_id else "favor_b", 48.0))
        elif balls_remaining == 0 or second.total_wickets >= 10:
            chasing_pct = 2.0
            factors.append(Factor("Chase fell short / all out", "favor_b" if chasing_team_id == match.team_a_id else "favor_a", 48.0))
        else:
            required_rr = runs_remaining / (balls_remaining / 6)
            current_rr = second.run_rate
            rr_delta = current_rr - required_rr
            wickets_in_hand_pct = (10 - second.total_wickets) / 10

            shift = rr_delta * 2.5 + (wickets_in_hand_pct - 0.5) * 35.0
            chasing_pct = round(_clamp(baseline_chasing_pct + shift, 2, 98), 1)

            factors.append(Factor(
                f"Required RR {required_rr:.1f} vs current RR {current_rr:.1f}",
                "favor_a" if (rr_delta > 0) == (chasing_team_id == match.team_a_id) else "favor_b",
                abs(rr_delta) * 2.5,
            ))
            factors.append(Factor(
                f"{second.total_wickets} wickets down, {10 - second.total_wickets} in hand",
                "favor_a" if (wickets_in_hand_pct >= 0.5) == (chasing_team_id == match.team_a_id) else "favor_b",
                abs(wickets_in_hand_pct - 0.5) * 35.0,
            ))

        team_a_pct = chasing_pct if chasing_team_id == match.team_a_id else round(100 - chasing_pct, 1)
        result = PredictionResult(
            team_a_win_pct=team_a_pct, team_b_win_pct=round(100 - team_a_pct, 1),
            context=f"over_{second.total_balls // 6}", factors=factors,
        )
        return self._persist(match_id, result)

    # ------------------------------------------------------------------
    def _persist(self, match_id: int, result: PredictionResult) -> Prediction:
        row = Prediction(
            match_id=match_id, computed_at=datetime.now(timezone.utc),
            team_a_win_pct=result.team_a_win_pct, team_b_win_pct=result.team_b_win_pct,
            context=result.context, factors=result.factors_payload(),
        )
        self.db.add(row)
        self.db.flush()
        return row

    def momentum_timeline(self, match_id: int) -> list[Prediction]:
        """Full prediction history in chronological order — the momentum
        graph data for section 15."""
        return (
            self.db.query(Prediction)
            .filter(Prediction.match_id == match_id)
            .order_by(Prediction.computed_at.asc())
            .all()
        )
