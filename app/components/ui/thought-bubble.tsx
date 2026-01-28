import React from "react";

type ThoughtBubbleProps = {
  text?: string;
  size?: number;
  className?: string;
};

export function ThoughtBubble({
  text = "hold to speak",
  size = 140,
  className,
}: ThoughtBubbleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main cloud */}
      <path
        d="M40 90 
           C40 60, 70 45, 100 50 
           C130 40, 165 60, 160 90 
           C175 115, 150 145, 115 140 
           C95 155, 60 145, 60 120 
           C40 115, 30 100, 40 90Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Trailing bubbles */}
      <circle cx="75" cy="155" r="6" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="170" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="48" cy="182" r="3" stroke="currentColor" strokeWidth="2" />

      {/* Text */}
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fontSize="12"
        fontFamily="Inter, system-ui, sans-serif"
        fill="currentColor"
        opacity="0.7"
      >
        {text}
      </text>
    </svg>
  );
}
