import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { firstAllowedPath } from "@/lib/permissions";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect(firstAllowedPath(user.role, user.permissions));
  }
  redirect("/login");
}
