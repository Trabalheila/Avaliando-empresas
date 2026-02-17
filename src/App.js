import React from "react";
import { Routes, Route } from "react-router-dom";
// importe suas páginas reais aqui

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Home</div>} />
      <Route path="*" element={<div>404</div>} />
    </Routes>
  );
}
