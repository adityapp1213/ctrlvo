import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HomeLayout } from "./home-layout";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const user = await currentUser();
  const displayName =
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    user?.username ??
    "there";
  const message = `Hi, ${displayName}. How are you?`;

  return (
    <HomeLayout message={message} />
  );
}
