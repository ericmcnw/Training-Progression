export function getWeekBoundsSunday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}