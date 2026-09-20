import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage, ProjectPage } from "./pages";

import "./styles/global.css";

// main как общую страницу header + footer + contacts + project section
// залить на сервер
// добавить админку на редактирование списка участков + тумблер на вкл бегущей строки с текстом акции
// отдельный route под проект и там уже все секции пихнуть
// шрифт новый
// название?
// дизайн код палитры
// ссылка и redirect на телегу

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:slug" element={<ProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
