/**
 * Custom Image Loader dengan Error Handling
 * Handles timeout issues dengan external images
 */

export default function imageLoader({ src, width, quality }: {
  src: string;
  width: number;
  quality?: number;
}) {
  // List of problematic domains yang sering timeout
  const problematicDomains = [
    'i.ibb.co',
    'imgur.com',
    'postimg.cc',
    'ipfs.io',
    'gateway.pinata.cloud'
  ];

  // Check if domain is problematic
  const isProblematic = problematicDomains.some(domain => src.includes(domain));

  if (isProblematic) {
    // Return original URL tanpa optimization
    return src;
  }

  // For safe domains, use default Next.js optimization
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}
