export function buildDateRangeDescription(tracks) {
  const dates = tracks.map((t) => new Date(t.addedAt)).sort((a, b) => a - b);
  const format = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${format(dates[0])} – ${format(dates[dates.length - 1])}`;
}
