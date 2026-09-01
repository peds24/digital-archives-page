import { AsciiNote } from './AsciiNote';
import { DiscoveryPanel } from './DiscoveryPanel';
import type { DiscoverableTrack } from '../lib/types';

interface HomeViewProps {
  trackPool: DiscoverableTrack[];
  archiveCount: number;
}

export function HomeView({ trackPool, archiveCount }: HomeViewProps) {
  return (
    <div className="home-view">
      <AsciiNote className="home-hero" />
      <p className="home-lede">
        Every 30 songs Pedro likes on Spotify get sealed off into a numbered
        archive — {archiveCount} of them so far. This site is a browsable home
        for that collection: pull up any archive's full tracklist, or reroll
        five songs pulled at random from all of them to rediscover something
        you liked once and forgot about.
      </p>
      <DiscoveryPanel trackPool={trackPool} />
    </div>
  );
}
