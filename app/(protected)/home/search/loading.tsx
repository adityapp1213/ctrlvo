import { AppSidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header-1";
import { Globe, Loader2, Search } from "lucide-react";

export default function Loading() {
  return (
    <main className="h-screen bg-white flex overflow-hidden">
      <div className="sticky top-0 h-screen self-start">
        <AppSidebar />
      </div>
      <section className="flex-1 flex flex-col items-center">
        <div className="w-full">
          <Header />
        </div>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-full max-w-md px-6">
            <div className="flex items-center gap-3 text-blue-600">
              <Search className="w-5 h-5" />
              <div className="text-lg font-semibold">Searching…</div>
            </div>
            <div className="mt-10">
              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <div>Reading web pages</div>
              </div>
              <div className="mt-2 space-y-1 text-blue-600/90">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="text-sm truncate">source-{i + 1}.com</div>
                ))}
              </div>
            </div>
            <div className="mt-10 flex items-center gap-2 text-blue-600 font-semibold">
              <Globe className="w-5 h-5" />
              <div>Making a website for you!</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
