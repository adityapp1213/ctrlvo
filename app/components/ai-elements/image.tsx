import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import type { Experimental_GeneratedImage } from 'ai';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const Image = ({ base64, mediaType, className, alt }: ImageProps) => {
  const src = `data:${mediaType};base64,${base64}`;

  return (
    <NextImage
      src={src}
      alt={alt ?? ''}
      width={512}
      height={512}
      className={cn('h-auto max-w-full overflow-hidden rounded-md', className)}
    />
  );
};
