import React, { useEffect, useState } from "react";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import TrabalheiLaMobile from "./TrabalheiLaMobile";

export default function Home(props) {
  const [isMobile, setIsMobile] = useState(() => {
    // evita quebrar se algum dia rodar em ambiente sem window
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");

    const onChange = () => setIsMobile(mq.matches);

    // dispara 1x pra garantir estado correto
    onChange();

    // listener moderno vs Safari antigo
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } else {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  return isMobile ? (
    <TrabalheiLaMobile {...props} />
  ) : (
    <TrabalheiLaDesktop {...props} />
  );
}
