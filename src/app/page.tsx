import { AcquisitionDesk } from "@/components/AcquisitionDesk";
import { loadAcquisitionData } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadAcquisitionData();
  return <AcquisitionDesk initialData={data} />;
}
