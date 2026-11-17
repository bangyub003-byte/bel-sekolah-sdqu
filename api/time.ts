export default function handler(_req: any, res: any) {
  const now = new Date();
  const timestamp = now.getTime();

  return res.status(200).json({
    status: "success",
    timestamp,
    iso: now.toISOString(),
    timezone: "Asia/Jakarta (WIB)",
    timeFormatted: now.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    dateFormatted: now.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    serverOffsetMs: 0,
  });
}
