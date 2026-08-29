import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AuthProvider } from "./auth/useAuth";
import App from "./App";
import "./theme.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
