import { AsciiNote } from './AsciiNote';

interface HomeViewProps {
  archiveCount: number;
}

export function HomeView({ archiveCount }: HomeViewProps) {
  return (
    <div className="home-view">
      <AsciiNote className="home-hero" />
      <p className="home-lede">
        Every 30 songs Pedro likes on Spotify get sealed off into a numbered
        archive — {archiveCount} of them so far. This site is a browsable home
        for that collection: pull up any archive's full tracklist on the
        archives tab, or head to discover to shuffle up five songs pulled at
        random from all of them and rediscover something you liked once and
        forgot about.
      </p>
    </div>
  );
}
