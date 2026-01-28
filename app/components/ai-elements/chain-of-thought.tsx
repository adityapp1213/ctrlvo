import type { ComponentProps } from "react";
import Image from "next/image";

type ChainOfThoughtImageProps = ComponentProps<typeof Image>;

export function ChainOfThoughtImage(props: ChainOfThoughtImageProps) {
  return <Image {...props} alt={props.alt ?? ""} />;
}

ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
