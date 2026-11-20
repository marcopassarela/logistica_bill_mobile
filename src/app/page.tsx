import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { firstAllowedPath } from "@/lib/permissions";

export default async function Home() {
  const user = await getServerUser();
  if (user) {
    redirect(firstAllowedPath(user.role, user.permissions));
  }
  redirect("/login");
}
