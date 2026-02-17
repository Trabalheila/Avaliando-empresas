<div style={{position:"fixed", bottom:8, right:8, padding:"6px 10px", background:"#000", color:"#fff", fontSize:12, zIndex:99999}}>
  DEPLOY_CHECK_17_02
</div>


import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
