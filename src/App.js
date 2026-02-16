import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home"; // ajuste se o seu "Home" tiver outro nome
import CompanyPage from "./pages/CompanyPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/empresa/:slug" element={<CompanyPage />} />
    </Routes>
  );
}
