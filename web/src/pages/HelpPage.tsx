// Help & rules — keep in sync with the scoring engine (shared/scoring.ts, darkHorse.ts) and awards.
import { runTour } from '../tour';

export function HelpPage() {
  return (
    <div className="help">
      <h2>❓ How to play</h2>
      <p className="muted fine">Everything you need to know about predictions, points, and awards.</p>
      <p><button className="odds-btn" onClick={() => runTour()} data-testid="replay-tour">🎬 Replay the tour</button></p>

      <details className="help-sec" open>
        <summary>🚀 Getting started</summary>
        <ul>
          <li>Sign in with just a <b>name and a 4-digit PIN</b> — no email needed. Use the same name + PIN on any device to pick up where you left off.</li>
          <li>Predict scores in <b>Fixtures</b>, make your pre-tournament picks in <b>Awards</b>, and compete with friends in <b>Groups</b>.</li>
          <li>You can change your PIN, timezone, and the app's <b>theme</b> (including country looks) in <b>⋮ → Account</b>.</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>⚽ Predicting a match</summary>
        <ul>
          <li>Open <b>Fixtures</b>, find the match, type a scoreline in the two boxes and hit <b>Save</b>.</li>
          <li>After saving you can also pick the <b>first team to score</b> (tap a flag) and the <b>first player to score</b> (Select → search either squad).</li>
          <li>You can edit everything until <b>kickoff</b> — then the match locks. Clearing both score boxes and hitting <b>Clear</b> removes a saved prediction. Other people's picks stay hidden until a match locks.</li>
          <li>Matches are grouped into <b>Matchweeks 1–3</b> and one section per knockout round.</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>🧮 How points work (max 20 per match)</summary>
        <p>Points are <b>additive</b> — every part of your prediction that's right earns points:</p>
        <table className="help-table">
          <tbody>
            <tr><td>Correct match outcome (win/draw/win)</td><td>+2</td></tr>
            <tr><td>Correct goal difference</td><td>+3</td></tr>
            <tr><td>Exact final scoreline</td><td>+3</td></tr>
            <tr><td>Correct goals for home team</td><td>+2</td></tr>
            <tr><td>Correct goals for away team</td><td>+2</td></tr>
            <tr><td>Correct first team to score</td><td>+2</td></tr>
            <tr><td>Correct first player to score</td><td>+6</td></tr>
          </tbody>
        </table>
        <ul>
          <li>A perfect prediction = <b>20 points</b>.</li>
          <li>Predict an exact <b>0–0</b> and it ends 0–0 → you also nailed "nobody scores", so the first-team and first-player bonuses count too → the full <b>20</b>.</li>
          <li>Even a wrong result can score: predict 1–1 and it ends 5–1 → you nailed the away team's goals → <b>+2</b>.</li>
          <li>The first goalscorer counts goals in normal/extra time (own goals and penalty shootouts don't count).</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>★ The Joker (double points)</summary>
        <ul>
          <li>Tap <b>☆ Joker</b> on a match you've predicted to <b>double</b> whatever it scores.</li>
          <li>You get <b>one Joker per section</b> — one in each Matchweek and one in each knockout round.</li>
          <li>Setting a Joker on another match in the same section moves it. Jokered cards glow <b>yellow</b>.</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>🏆 Awards (picks close June 13!)</summary>
        <p>All award picks close on <b>June 13, 2 PM ET</b> — get them in early. Find them in the <b>Awards</b> tab. Award points are added to the leaderboards <b>when the tournament ends</b>; until then the Awards tab shows live standings as a preview.</p>
        <ul>
          <li><b>⭐ Player of the Tournament (+25)</b> — predict the tournament's best player.</li>
          <li><b>🥇 Golden Boot (+15)</b> — predict the top scorer. The live leader updates during the tournament.</li>
          <li><b>🏆 Tournament Winner (+10)</b> — predict the champion.</li>
          <li><b>🐴 Dark Horse (+20 / +10 / +5)</b> — pick a team; your score is their <b>title odds × how far they go</b> (deeper = better). The <b>lowest</b> score wins — so a big underdog going far beats a favourite doing the same. A group-stage exit effectively knocks you out of the running. Tap <b>📊 View odds</b> to compare all 48 teams.</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>👥 Groups & leaderboards</summary>
        <ul>
          <li>Create a group in <b>Groups</b> and share its <b>invite code</b>; friends join with that code.</li>
          <li>Each group has its own leaderboard; the <b>Global leaderboard</b> (⋮ menu) ranks everyone.</li>
          <li>Ties break by: total points → exact scorelines → correct results → name.</li>
          <li><b>⋮ → My Points</b> shows your full match-by-match breakdown.</li>
        </ul>
      </details>

      <details className="help-sec">
        <summary>🔴 Live scores & timing</summary>
        <ul>
          <li>Matches in play show a pulsing <b>● LIVE</b> badge with the running score; the page refreshes itself every minute.</li>
          <li>Points appear in each card's bubble shortly after full-time (first-scorer bonuses can take a few extra minutes).</li>
          <li>Kickoff times show in <b>your timezone</b> — change it in Account if you're travelling.</li>
        </ul>
      </details>
    </div>
  );
}
