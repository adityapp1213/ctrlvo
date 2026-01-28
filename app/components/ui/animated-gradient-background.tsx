'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface AnimatedGradientBackgroundProps {
  startingGap?: number
  Breathing?: boolean
  gradientColors?: string[]
  gradientStops?: number[]
  animationSpeed?: number
  breathingRange?: number
  containerStyle?: React.CSSProperties
  containerClassName?: string
  topOffset?: number
  className?: string
}

const NOISE_SVG_DATA_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"

export const AnimatedGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({
  startingGap = 125,
  Breathing = false,
  gradientColors = ['#ffffff', '#2979FF', '#FF80AB', '#FF6D00', '#FFD600', '#00E676', '#3D5AFE'],
  gradientStops = [35, 50, 60, 70, 80, 90, 100],
  animationSpeed = 0.02,
  breathingRange = 5,
  containerStyle = {},
  topOffset = 0,
  containerClassName = '',
  className,
}) => {
  if (gradientColors.length !== gradientStops.length) {
    throw new Error(
      `GradientColors and GradientStops must have the same length. Received gradientColors length: ${gradientColors.length}, gradientStops length: ${gradientStops.length}`
    )
  }

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const gradientStopsString = gradientStops
      .map((stop, index) => `${gradientColors[index]} ${stop}%`)
      .join(', ')

    const setGradient = (width: number) => {
      const gradient = `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${gradientStopsString})`
      if (containerRef.current) {
        containerRef.current.style.background = gradient
      }
    }

    if (!Breathing) {
      setGradient(startingGap)
      return
    }

    let animationFrame: number
    let width = startingGap
    let directionWidth = 1

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1
      if (width <= startingGap - breathingRange) directionWidth = 1

      width += directionWidth * animationSpeed
      setGradient(width)
      animationFrame = requestAnimationFrame(animateGradient)
    }

    animationFrame = requestAnimationFrame(animateGradient)
    return () => cancelAnimationFrame(animationFrame)
  }, [startingGap, Breathing, gradientColors, gradientStops, animationSpeed, breathingRange, topOffset])

  return (
    <motion.div
      key="animated-gradient-background"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: 2, ease: [0.25, 0.1, 0.25, 1] },
      }}
      className={cn('absolute inset-0 overflow-hidden', className)}
    >
      <div ref={containerRef} style={containerStyle} className={cn('absolute inset-0 transition-transform', containerClassName)} />
      <div
        aria-hidden
        className="absolute inset-0 opacity-15 mix-blend-multiply"
        style={{ backgroundImage: `url("${NOISE_SVG_DATA_URL}")` }}
      />
    </motion.div>
  )
}

export default AnimatedGradientBackground
