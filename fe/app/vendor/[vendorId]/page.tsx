import { VendorDetailPage } from "@/components/views/vendor-detail-page"

export default async function VendorDetailRoute({
  params,
}: {
  params: Promise<{ vendorId: string }>
}) {
  const { vendorId } = await params

  return <VendorDetailPage vendorId={vendorId} />
}

