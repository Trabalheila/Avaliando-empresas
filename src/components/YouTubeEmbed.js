// src/components/YouTubeEmbed.js
import React from "react";
import "./YouTubeEmbed.css";

/**
 * Player responsivo para vídeos do YouTube (incluindo Shorts).
 * Usa proporção 16:9 e carregamento preguiçoso para não impactar a LCP.
 */
const YouTubeEmbed = ({ videoId, title, className = "" }) => {
  if (!videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1&controls=1&loop=0&modestbranding=1&rel=0`;

  return (
    <div className={`video-responsive ${className}`}>
      <iframe
        src={embedUrl}
        title={title || "Vídeo do YouTube"}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      ></iframe>
    </div>
  );
};

export default YouTubeEmbed;
