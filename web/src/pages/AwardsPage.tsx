import { GoldenBootPage } from './GoldenBootPage';
import { DarkHorseAward } from '../components/DarkHorseAward';

// Awards hub — pre-tournament predictions, locked when the tournament kicks off.
// (Tournament Winner and Player of the Tournament are added next.)
export function AwardsPage() {
  return (
    <div className="awards">
      <GoldenBootPage />
      <DarkHorseAward />
    </div>
  );
}
