"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowDownRight, Star } from "lucide-react";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

  interface Hero3Props {
  heading?: string;
  description?: string;
  buttons?: {
    primary?: {
      text: string;
      url: string;
    };
    secondary?: {
      text: string;
      url: string;
    };
  };
  reviews?: {
    count: number;
    avatars: {
      src: string;
      alt: string;
    }[];
    rating?: number;
  };
}

const Hero3 = ({
  heading = "Ai assistant that actually does Stuff!",
  description = "A voice-first search assistant that finds what you need and brings it right into the chat.",
  buttons = {
    primary: {
      text: "Sign Up",
      url: "https://www.shadcnblocks.com",
    },
    secondary: {
      text: "Get Started",
      url: "https://www.shadcnblocks.com",
    },
  },
  reviews = {
    count: 200,
    rating: 5.0,
    avatars: [
      {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-1.webp",
        alt: "Avatar 1",
      },
      {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-2.webp",
        alt: "Avatar 2",
      },
      {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-3.webp",
        alt: "Avatar 3",
      },
      {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-4.webp",
        alt: "Avatar 4",
      },
      {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-5.webp",
        alt: "Avatar 5",
      },
    ],
  },
}: Hero3Props) => {
  const { openSignIn, openSignUp } = useClerk();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<null | "signIn" | "signUp">(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  function trackEvent(name: string, props?: Record<string, unknown>) {
    const body = JSON.stringify({ name, props, ts: Date.now(), vw: window.innerWidth });
    const url = "/api/analytics";
    if ("sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  }
  useEffect(() => {
    trackEvent("hero_impression");
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    const offsetX = (cursor.x / window.innerWidth - 0.5) * 40;
    const offsetY = (cursor.y / window.innerHeight - 0.5) * 20;
    setEyePos({ x: offsetX, y: offsetY });
  }, [cursor]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  async function handleSignUp() {
    if (isSignedIn) {
      router.push("/home");
      return;
    }
    try {
      setAuthError(null);
      setLoadingAction("signUp");
      trackEvent("hero_cta_click", { type: "signUp" });
      await openSignUp({ redirectUrl: "/home", afterSignUpUrl: "/home" });
    } catch {
      setAuthError("Authentication failed. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSignIn() {
    if (isSignedIn) {
      router.push("/home");
      return;
    }
    try {
      setAuthError(null);
      setLoadingAction("signIn");
      trackEvent("hero_cta_click", { type: "signIn" });
      await openSignIn({ redirectUrl: "/home", afterSignInUrl: "/home" });
    } catch {
      setAuthError("Authentication failed. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="p-8 sm:p-10 md:p-12">
      <div className="container pt-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="mx-auto flex flex-col items-center text-center md:ml-auto lg:max-w-3xl lg:items-start lg:text-left">
          <h1 className="my-6 text-pretty text-4xl font-bold lg:text-6xl xl:text-7xl">
            {heading}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-xl lg:text-xl">
            {description}
          </p>
          <div className="mb-12 flex w-fit flex-col items-center gap-4 sm:flex-row">
            <span className="inline-flex items-center -space-x-4">
              {reviews.avatars.map((avatar, index) => (
                <Avatar key={index} className="size-12 border">
                  <AvatarImage src={avatar.src} alt={avatar.alt} />
                </Avatar>
              ))}
            </span>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, index) => (
                  <Star
                    key={index}
                    className="size-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
                <span className="mr-1 font-semibold">
                  {reviews.rating?.toFixed(1)}
                </span>
              </div>
              <p className="text-muted-foreground text-left font-medium">
                from {reviews.count}+ reviews
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col justify-center gap-2 sm:flex-row lg:justify-start">
            {buttons.primary && (
              <Button
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSignUp}
                aria-label={buttons.primary.text}
                aria-busy={loadingAction === "signUp"}
                disabled={!!loadingAction}
              >
                {loadingAction === "signUp" ? (
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownRight className="size-4 animate-spin" />
                    Loading
                  </span>
                ) : (
                  buttons.primary.text
                )}
              </Button>
            )}
            {buttons.secondary && (
              <Button
                variant="outline"
                onClick={handleSignIn}
                aria-label={buttons.secondary.text}
                aria-busy={loadingAction === "signIn"}
                disabled={!!loadingAction}
              >
                {loadingAction === "signIn" ? (
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownRight className="size-4 animate-spin" />
                    Loading
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    {buttons.secondary.text}
                    <ArrowDownRight className="size-4" />
                  </span>
                )}
              </Button>
            )}
          </div>
          {authError && (
            <div role="alert" aria-live="assertive" className="mt-3 text-sm text-destructive">
              {authError}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-[700px]">
            <Image
              src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/cloud.jpg"
              alt="cloud"
              width={1400}
              height={800}
              className="w-full h-auto rounded-md"
            />
            {["left", "right"].map((side, idx) => (
              <div
                key={side}
                className="absolute flex justify-center items-end overflow-hidden"
                style={{
                  top: isMobile ? 60 : 80,
                  left: isMobile ? (idx === 0 ? "55%" : "75%") : idx === 0 ? 140 : 260,
                  transform: isMobile ? "translateX(-50%)" : undefined,
                  width: isMobile ? 24 : 32,
                  height: blink ? (isMobile ? 4 : 6) : (isMobile ? 30 : 42),
                  borderRadius: blink ? "2px" : "50% / 60%",
                  backgroundColor: "white",
                  transition: "all 0.15s ease",
                }}
              >
                {!blink && (
                  <div
                    className="bg-black"
                    style={{
                      width: isMobile ? 10 : 16,
                      height: isMobile ? 10 : 16,
                      borderRadius: "50%",
                      marginBottom: isMobile ? 2 : 4,
                      transform: `translate(${eyePos.x}px, ${eyePos.y * 0}px)`,
                      transition: "all 0.1s ease",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero3 };
