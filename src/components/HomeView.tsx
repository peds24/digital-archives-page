interface HomeViewProps {
  archiveCount: number;
}

export function HomeView({ archiveCount }: HomeViewProps) {
  return (
    <div className="home-view">
      <p className="home-lede">
        <strong>Every 30 songs I like on Spotify get sealed off into a numbered
        archive — {archiveCount} of them so far.</strong>
      </p>
      <p className="home-lede">
        This site is a browsable home for that collection: pull up any archive's full tracklist on the archives tab, or head to discover to shuffle up five songs pulled at random from all of them and rediscover something you liked once andforgot about.
      </p>
    </div>
  );
}
