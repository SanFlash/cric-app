"""
Match-completion awards. Every number here is read directly from the
BattingPerformance/BowlingPerformance rows StatisticsEngine already wrote
when the match was finalized — nothing is invented or estimated. The
"game changer" note on each award is the same discipline the InsightEngine
already follows: a real, computable comparison against the match's own
context (their share of the team's total, or their economy against the
match's overall run rate) rather than generic praise.
"""
from sqlalchemy.orm import Session

from app.models.performance import BattingPerformance, BowlingPerformance
from app.models.match import Match, Innings
from app.models.org import Player


class MatchAward:
    def __init__(self, player: Player, headline: str, game_changer_note: str | None):
        self.player = player
        self.headline = headline
        self.game_changer_note = game_changer_note


class MatchSummary:
    def __init__(
        self,
        player_of_the_match: MatchAward | None,
        highest_scorer: MatchAward | None,
        best_bowler: MatchAward | None,
    ):
        self.player_of_the_match = player_of_the_match
        self.highest_scorer = highest_scorer
        self.best_bowler = best_bowler


class MatchSummaryEngine:
    def __init__(self, db: Session):
        self.db = db

    def compute(self, match_id: int) -> MatchSummary | None:
        match = self.db.get(Match, match_id)
        if not match or match.status.value != "completed":
            return None

        battings = self.db.query(BattingPerformance).filter(BattingPerformance.match_id == match_id).all()
        bowlings = self.db.query(BowlingPerformance).filter(BowlingPerformance.match_id == match_id).all()
        if not battings and not bowlings:
            return None

        innings_by_id = {i.id: i for i in self.db.query(Innings).filter(Innings.match_id == match_id).all()}

        # --- Highest scorer: most runs, strike rate as the headline, their
        # share of their team's total as the "why it mattered" note. ---
        highest_scorer = None
        if battings:
            top_bat = max(battings, key=lambda b: b.runs)
            sr = (top_bat.runs / top_bat.balls_faced * 100) if top_bat.balls_faced else 0.0
            team_total = innings_by_id[top_bat.innings_id].total_runs if top_bat.innings_id in innings_by_id else None
            share_note = None
            if team_total:
                pct = round(top_bat.runs / team_total * 100)
                share_note = f"{pct}% of the team's total ({top_bat.runs} of {team_total})"
            highest_scorer = MatchAward(
                player=self.db.get(Player, top_bat.player_id),
                headline=f"{top_bat.runs} runs off {top_bat.balls_faced} balls (SR {sr:.1f})",
                game_changer_note=share_note,
            )

        # --- Best bowler: most wickets first, economy as tiebreak — the
        # standard cricket convention. Note compares their economy against
        # the match's overall run rate: a real, checkable claim. ---
        best_bowler = None
        if bowlings:
            def bowl_key(b: BowlingPerformance) -> tuple[int, float]:
                overs = b.balls_bowled / 6 if b.balls_bowled else 0
                economy = (b.runs_conceded / overs) if overs else 999.0
                return (-b.wickets, economy)

            top_bowl = min(bowlings, key=bowl_key)
            overs_bowled = top_bowl.balls_bowled / 6
            economy = (top_bowl.runs_conceded / overs_bowled) if overs_bowled else 0.0
            innings = innings_by_id.get(top_bowl.innings_id)
            rr_note = None
            if innings and innings.total_balls:
                match_rr = innings.total_runs / (innings.total_balls / 6)
                # Only claim this as a positive if it actually was one —
                # conceding runs FASTER than the innings' overall rate is
                # not something to highlight as "why they mattered", even
                # if they still took the most wickets.
                if economy < match_rr:
                    rr_note = f"Choked the run rate — {economy:.1f} economy vs the innings' {match_rr:.1f}"
            best_bowler = MatchAward(
                player=self.db.get(Player, top_bowl.player_id),
                headline=f"{top_bowl.wickets}/{top_bowl.runs_conceded} ({economy:.1f} econ, {self._overs_display(top_bowl.balls_bowled)} ov)",
                game_changer_note=rr_note,
            )

        # --- Player of the Match: simple, transparent composite favouring
        # match-winning impact over either discipline alone — a strong
        # all-round game (runs AND wickets) can outscore a single-discipline
        # standout, matching how these are picked in practice. Batting and
        # bowling contributions are summed per player, so an all-rounder's
        # two performances count together, not just their better one. ---
        contribution: dict[int, float] = {}
        for b in battings:
            contribution[b.player_id] = contribution.get(b.player_id, 0.0) + b.runs + b.fours * 1 + b.sixes * 2
        for b in bowlings:
            overs = b.balls_bowled / 6 if b.balls_bowled else 0
            economy = (b.runs_conceded / overs) if overs else 6.0
            bowling_score = b.wickets * 25 - economy
            contribution[b.player_id] = contribution.get(b.player_id, 0.0) + bowling_score

        player_of_the_match = None
        if contribution:
            best_id = max(contribution, key=lambda pid: contribution[pid])
            best_player = self.db.get(Player, best_id)
            bat_line = next((b for b in battings if b.player_id == best_id), None)
            bowl_line = next((b for b in bowlings if b.player_id == best_id), None)
            parts = []
            if bat_line:
                parts.append(f"{bat_line.runs} runs")
            if bowl_line:
                parts.append(f"{bowl_line.wickets} wicket{'s' if bowl_line.wickets != 1 else ''}")
            headline = " & ".join(parts) if parts else "Standout performance"
            all_rounder_note = "All-round impact — contributed with both bat and ball" if bat_line and bowl_line else None
            player_of_the_match = MatchAward(player=best_player, headline=headline, game_changer_note=all_rounder_note)

        return MatchSummary(player_of_the_match, highest_scorer, best_bowler)

    @staticmethod
    def _overs_display(balls: int) -> str:
        return f"{balls // 6}.{balls % 6}"
