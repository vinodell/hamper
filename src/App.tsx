import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Home } from "./pages/Home";

const Main = lazy(() => import("./pages/Main").then((module) => ({ default: module.Main })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));

import "./styles/global.css";


function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<main className="route-loading" role="status">Загружаем страницу…</main>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:slug" element={<Main />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
