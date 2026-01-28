// Marketing hero section with Atom Ctrl branding and landing search UI
'use client'

import React, { useState } from 'react'
import { TextEffect } from '@/components/ui/text-effect'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { AnimatedGradientBackground } from '@/components/ui/animated-gradient-background'
import {
    PromptInputProvider,
    useProviderAttachments,
} from '@/components/ai-elements/prompt-input'
import { AudioLines, Globe, Grid, Map, Plus, Search, Youtube } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HeroHeader } from '@/components/layout/header'
import { LogoCloud } from '@/components/graphics/logo-cloud'

// Shared motion variants for animated elements in the hero
const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring' as const,
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
}

// Top-level hero wrapper: gradient background, header, and hero content
export default function HeroSection() {
    return (
        <div className="relative w-full bg-white">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px] overflow-hidden sm:h-[560px] lg:h-[640px]"
            >
                <AnimatedGradientBackground />
            </div>
            <HeroHeader />

            <main className="overflow-hidden [--color-primary-foreground:var(--color-white)] [--color-primary:var(--color-green-600)]">
                <section>
                    <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-32 lg:pt-48">
                        <div className="relative z-10 mx-auto max-w-4xl text-center">
                            <h1 className="inline-flex items-baseline gap-2 whitespace-nowrap text-5xl font-medium md:text-6xl">
                                <TextEffect
                                    preset="fade-in-blur"
                                    speedSegment={0.3}
                                    as="span">
                                    Ai assistant that does
                                </TextEffect>
                                <TextShimmer className="align-baseline [--base-color:#60A5FA] [--base-gradient-color:#2563EB]">
                                    Stuff!
                                </TextShimmer>
                            </h1>
                            <TextEffect
                                per="line"
                                preset="fade-in-blur"
                                speedSegment={0.3}
                                delay={0.5}
                                as="p"
                                className="mx-auto mt-6 max-w-2xl text-pretty text-lg">
                                A voice-first search assistant that finds what you need and brings it right into the chat.
                            </TextEffect>

                            <AnimatedGroup
                                variants={{
                                    container: {
                                        visible: {
                                            transition: {
                                                staggerChildren: 0.05,
                                                delayChildren: 0.75,
                                            },
                                        },
                                    },
                                    ...transitionVariants,
                                }}
                                className="relative mt-12">
                                <HeroSearchShowcase />

                                <div
                                    aria-hidden
                                    className="relative mx-auto mt-32 max-w-2xl pb-16 text-left"
                                >
                                    <div className="bg-background border-border/50 absolute inset-0 mx-auto w-80 -translate-x-3 -translate-y-12 rounded-[2rem] border p-2 [mask-image:linear-gradient(to_bottom,#000_50%,transparent_90%)] sm:-translate-x-6">
                                        <div className="relative h-96 overflow-hidden rounded-[1.5rem] border p-2 pb-12 before:absolute before:inset-0 before:bg-[repeating-linear-gradient(-45deg,var(--color-border),var(--color-border)_1px,transparent_1px,transparent_6px)] before:opacity-50"></div>
                                    </div>
                                    <div className="bg-muted dark:bg-background/50 border-border/50 mx-auto w-80 translate-x-4 rounded-[2rem] border p-2 backdrop-blur-3xl [mask-image:linear-gradient(to_bottom,#000_50%,transparent_90%)] sm:translate-x-8">
                                        <div className="bg-background space-y-2 overflow-hidden rounded-[1.5rem] border p-2 shadow-xl dark:bg-white/5 dark:shadow-black dark:backdrop-blur-3xl">
                                            <AppComponent />

                                            <div className="bg-muted rounded-[1rem] p-4 pb-16 dark:bg-white/5"></div>
                                        </div>
                                    </div>
                                </div>
                            </AnimatedGroup>
                        </div>
                    </div>
                </section>

                <LogoCloud />
            </main>
        </div>
    )
}

// Compact fake search / voice input surface shown in the hero
const HeroSearchShowcase = () => {
    const [mode, setMode] = useState<'search' | 'voice'>('search')

    const handleModeChange = (newMode: 'search' | 'voice') => {
        setMode(newMode)
    }

    return (
        <PromptInputProvider>
            <div className="relative">
                <div className="bg-background relative z-10 mx-auto max-w-2xl rounded-full border border-border/50 p-2.5 text-left shadow-lg shadow-black/5 backdrop-blur-sm">
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5 text-xs font-medium">
                            <button
                                type="button"
                                className={cn(
                                    'flex flex-1 items-center gap-1 rounded-full px-2 py-1 transition-colors',
                                    mode === 'search'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground'
                                )}
                                onClick={() => handleModeChange('search')}>
                                <Search className="h-3.5 w-3.5" />
                                <span>Search</span>
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    'flex flex-1 items-center gap-1 rounded-full px-2 py-1 transition-colors',
                                    mode === 'voice'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground'
                                )}
                                onClick={() => handleModeChange('voice')}>
                                <AudioLines className="h-3.5 w-3.5" />
                                <span>Voice</span>
                            </button>
                        </div>

                        <div className="flex flex-1 items-center gap-2">
                            <PromptInputAttachmentsWrapper />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        className="rounded-full border-dashed"
                                        disabled>
                                        <Grid className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem disabled>
                                        <Globe className="mr-2 h-4 w-4" />
                                        <span>Web Search</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                        <Map className="mr-2 h-4 w-4" />
                                        <span>Maps</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                        <Youtube className="mr-2 h-4 w-4" />
                                        <span>YouTube</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </PromptInputProvider>
    )
}

// Small pill that shows attachment count and disabled attachment button
const PromptInputAttachmentsWrapper = () => {
    const attachments = useProviderAttachments()

    return (
        <div className="flex flex-1 items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5">
            <div className="flex flex-1 items-center gap-2">
                <Grid className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ask Atom Ctrl anything...</span>
            </div>

            <div className="flex items-center gap-1.5">
                {attachments.files.length > 0 && (
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {attachments.files.length} attached
                    </span>
                )}

                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    disabled>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

// Example "Steps" card rendered inside the hero phone mockup
const AppComponent = () => {
    return (
        <div className="relative space-y-3 rounded-[1rem] bg-white/5 p-4">
            <div className="flex items-center gap-1.5 text-orange-400">
                <svg
                    className="size-5"
                    xmlns="http://www.w3.org/2000/svg"
                    width="1em"
                    height="1em"
                    viewBox="0 0 32 32">
                    <g fill="none">
                        <path
                            fill="#ff6723"
                            d="M26 19.34c0 6.1-5.05 11.005-11.15 10.641c-6.269-.374-10.56-6.403-9.752-12.705c.489-3.833 2.286-7.12 4.242-9.67c.34-.445.689 3.136 1.038 2.742c.35-.405 3.594-6.019 4.722-7.991a.694.694 0 0 1 1.028-.213C18.394 3.854 26 10.277 26 19.34"></path>
                        <path
                            fill="#ffb02e"
                            d="M23 21.851c0 4.042-3.519 7.291-7.799 7.144c-4.62-.156-7.788-4.384-7.11-8.739C9.07 14.012 15.48 10 15.48 10S23 14.707 23 21.851"></path>
                    </g>
                </svg>
                <div className="text-sm font-medium">Steps</div>
            </div>
            <div className="space-y-3">
                <div className="text-foreground border-b border-white/10 pb-3 text-sm font-medium">This year, you are walking more on average than you did in 2023.</div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Daily average steps</span>
                            <span>+2,530</span>
                        </div>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-1.5 rounded-full"></div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Best day</span>
                            <span>15,872 steps</span>
                        </div>
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"></div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Weekly consistency</span>
                            <span>92%</span>
                        </div>
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}
