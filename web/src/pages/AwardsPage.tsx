import { useQuery } from '@tanstack/react-query';
import { AWARDS_LOCK_ISO, awardsLocked } from '@wc2026/shared';
import { api } from '../api/client';
import { GoldenBootPage } from './GoldenBootPage';
import { DarkHorseAward } from '../components/DarkHorseAward';
import { TournamentWinnerAward } from '../components/TournamentWinnerAward';
import { PlayerOfTournamentAward } from '../components/PlayerOfTournamentAward';
import { usePrefs } from '../context/PrefsContext';

// Awards hub — pre-tournament predictions, locked June 13 at 2 PM ET.
export function AwardsPage() {
  const { timeZone } = usePrefs();
  // Drive the banner off the server-authoritative lock flag (shared by all award
  // queries) rather than the device clock, so the banner can't contradict the
  // individual awards' locked state on a skewed client. Fall back to the client
  // clock only until the (cached) query resolves.
  const lockQuery = useQuery({ queryKey: ['golden-boot'], queryFn: api.goldenBoot, staleTime: 30_000 });
  const locked = lockQuery.data?.locked ?? awardsLocked(new Date());
  const localDeadline = new Date(AWARDS_LOCK_ISO).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short',
  });
  return (
    <div className="awards">
      {!locked ? (
        <div className="awards-deadline" data-testid="awards-deadline">
          ⏳ Picks close <b>June 13, 2:00 PM</b> (Toronto) — that's <b>{localDeadline}</b> your time.
        </div>
      ) : (
        <div className="awards-deadline locked">🔒 Picks closed June 13, 2 PM ET.</div>
      )}
      <p className="muted fine">🏁 Award points are added to the leaderboards when the tournament ends — until then you'll see live standings as a preview.</p>
      <PlayerOfTournamentAward />
      <GoldenBootPage />
      <TournamentWinnerAward />
      <DarkHorseAward />
    </div>
  );
}
