import { GoldenBootPage } from './GoldenBootPage';
import { DarkHorseAward } from '../components/DarkHorseAward';
import { TournamentWinnerAward } from '../components/TournamentWinnerAward';
import { PlayerOfTournamentAward } from '../components/PlayerOfTournamentAward';

// Awards hub — pre-tournament predictions, locked when the tournament kicks off.
export function AwardsPage() {
  return (
    <div className="awards">
      <p className="muted fine">🏁 Award points are added to the leaderboards when the tournament ends — until then you'll see live standings as a preview.</p>
      <PlayerOfTournamentAward />
      <GoldenBootPage />
      <TournamentWinnerAward />
      <DarkHorseAward />
    </div>
  );
}
