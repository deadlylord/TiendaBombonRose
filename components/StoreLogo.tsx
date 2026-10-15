import React from 'react';

// Display bounds measured from the current original uploads, including edge padding.
// The image files remain intact. Unknown uploads use the standard contained image.
const logoFrames: Record<string, { width: number; height: number; viewBox: string }> = {
  '1792074519889-292326.png': { width: 1512, height: 1512, viewBox: '96 520 1320 656' },
  '1792074318157-292322.png': { width: 1702, height: 630, viewBox: '409 86 787 427' },
};

const StoreLogo: React.FC<{ src: string; alt: string; className?: string; id?: string }> = ({ src, alt, className, id }) => {
  let filename = '';
  try { filename = decodeURIComponent(new URL(src, 'https://tiendabombon.netlify.app').pathname).split('/').pop() || ''; } catch { /* Use the normal image fallback. */ }
  const frame = logoFrames[filename];
  if (!frame) return <img src={src} alt={alt} className={className} id={id} />;
  return <svg role="img" aria-label={alt} id={id} className={className} viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet">
    <image href={src} width={frame.width} height={frame.height} />
  </svg>;
};

export default StoreLogo;
