import { GoldenBootPage } from './GoldenBootPage';
import { DarkHorseAward } from '../components/DarkHorseAward';
import { TournamentWinnerAward } from '../components/TournamentWinnerAward';
import { PlayerOfTournamentAward } from '../components/PlayerOfTournamentAward';

// Awards hub — pre-tournament predictions, locked when the tournament kicks off.
export function AwardsPage() {
  return (
    <div className="awards">
      <PlayerOfTournamentAward />
      <GoldenBootPage />
      <TournamentWinnerAward />
      <DarkHorseAward />
    </div>
  );
}
