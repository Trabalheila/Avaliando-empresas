import React from "react";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import TrabalheiLaMobile from "./TrabalheiLaMobile";

export default function Home(props) {
  const isMobile = window.innerWidth < 768;
  return isMobile ? <TrabalheiLaMobile {...props} /> : <TrabalheiLaDesktop {...props} />;
}
