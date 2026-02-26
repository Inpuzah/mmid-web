import { redirect } from "next/navigation";

function toSingle(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LegacyEntryRouteRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    const single = toSingle(value);
    if (typeof single === "string" && single.length > 0) {
      params.set(key, single);
    }
  }

  const suffix = params.toString();
  redirect(suffix ? `/reports/new?${suffix}` : "/reports/new");
}
