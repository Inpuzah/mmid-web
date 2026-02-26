import { redirect } from "next/navigation";

export default function AdminProposalsRedirectPage() {
  redirect("/maintainer/reports");
}
