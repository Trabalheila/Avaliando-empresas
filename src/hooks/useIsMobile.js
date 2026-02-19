// src/hooks/useIsMobile.js
import { useState, useEffect } from 'react';

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      // Se não estiver no navegador (SSR), assume desktop por padrão ou o que for mais seguro
      return;
    }

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    checkIsMobile(); // Verifica no carregamento inicial
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
