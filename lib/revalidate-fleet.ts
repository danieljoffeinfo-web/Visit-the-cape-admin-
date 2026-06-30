import { fleetAvailabilityRevalidationPaths, revalidateWebsitePaths } from '@/lib/revalidate-website'

export async function revalidateFleetAvailabilityOnWebsite() {
  return revalidateWebsitePaths(fleetAvailabilityRevalidationPaths())
}
