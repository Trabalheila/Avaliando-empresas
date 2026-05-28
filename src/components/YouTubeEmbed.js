// src/components/YouTubeEmbed.js
import React, { useEffect, useRef } from "react";
import "./YouTubeEmbed.css";

/**
 * Player responsivo para vídeos do YouTube (incluindo Shorts).
 * Usa proporção 16:9 e carregamento preguiçoso para não impactar a LCP.
 * O vídeo inicia com som habilitado e volume em 50% (via IFrame API).
 */

// Volume inicial (0-100) aplicado quando o player estiver pronto.
const INITIAL_VOLUME = 50;

// Carrega o script da IFrame API do YouTube apenas uma vez.
let ytApiPromise = null;
const loadYouTubeApi = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") {
        try { prev(); } catch (_) { /* noop */ }
      }
      resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
};

const YouTubeEmbed = ({ videoId, title, className = "" }) => {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoId || !iframeRef.current) return undefined;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !iframeRef.current) return;
      try {
        playerRef.current = new YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              try {
                event.target.unMute();
                event.target.setVolume(INITIAL_VOLUME);
              } catch (_) { /* noop */ }
            },
          },
        });
      } catch (_) { /* noop */ }
    });

    return () => {
      cancelled = true;
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try { playerRef.current.destroy(); } catch (_) { /* noop */ }
      }
      playerRef.current = null;
    };
  }, [videoId]);

  if (!videoId) return null;

  // enablejsapi=1 é necessário para que a IFrame API controle o player.
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&loop=0&modestbranding=1&rel=0&enablejsapi=1`;

  return (
    <div className={`video-responsive ${className}`}>
      <iframe
        ref={iframeRef}
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
