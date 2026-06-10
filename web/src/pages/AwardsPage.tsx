import { GoldenBootPage } from './GoldenBootPage';
import { DarkHorseAward } from '../components/DarkHorseAward';
import { TournamentWinnerAward } from '../components/TournamentWinnerAward';

// Awards hub — pre-tournament predictions, locked when the tournament kicks off.
// (Player of the Tournament is added next.)
export function AwardsPage() {
  return (
    <div className="awards">
      <GoldenBootPage />
      <TournamentWinnerAward />
      <DarkHorseAward />
    </div>
  );
}
