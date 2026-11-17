export default function handler(_req: any, res: any) {
  return res.status(200).json({
    status: "ok",
    app: "Bel Sekolah SD QUR'AN UNGGULAN",
  });
}
