import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/ui/sidebar";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { HomeSearchInput } from "./home-search-input";
import { HomeCloud } from "@/components/ui/home-cloud";
import { ThoughtBubble } from "@/components/ui/thought-bubble";

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
    <main className="h-screen w-full bg-white flex overflow-hidden">
      <div className="h-full shrink-0">
        <AppSidebar />
      </div>
      <section className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center pt-12">
          <div className="w-full max-w-3xl px-4 text-center">
            <TextShimmer
              duration={1.2}
              className="mb-4 text-2xl font-semibold [--base-color:theme(colors.blue.600)] [--base-gradient-color:theme(colors.blue.200)] dark:[--base-color:theme(colors.blue.700)] dark:[--base-gradient-color:theme(colors.blue.400)]"
            >
              {message}
            </TextShimmer>
            <div className="flex justify-center mb-4">
              <HomeCloud />
            </div>
          </div>
        </div>
        <div className="w-full px-4 pb-96 flex justify-center shrink-0">
          <div className="w-full max-w-3xl">
            <HomeSearchInput />
          </div>
        </div>
      </section>
    </main>
  );
}
