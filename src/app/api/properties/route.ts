import { loadAcquisitionData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadAcquisitionData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
