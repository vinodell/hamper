import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Admin, Home, Main } from "./pages";

import "./styles/global.css";

// добавить оптимизацию по загрузке

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:slug" element={<Main />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
