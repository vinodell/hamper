import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { lazy, Suspense } from "react";
import { Home } from "./pages/Home";
import { PlotsProvider } from "./hooks/PlotsProvider";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { RouteScroll } from "./components/RouteScroll";
import { adminPath } from "./lib/routes";

import "./styles/tailwind.css";
import "./styles/global.css";
import "./App.css";

const Main = lazy(() =>
  import("./pages/Main").then((module) => ({ default: module.Main })),
);
const Admin = lazy(() =>
  import("./pages/Admin").then((module) => ({ default: module.Admin })),
);

// добавить иконку в таблицу на домклик
// из таблицы "выбрать" попап на клике при карте
// пока скрыть кнопку с генпланом
// добавить фичу скопировать координаты на веб версии и построить маршрут на мобильной версии
// обновлю фотографии
// поменять Hamper на Хампер


const App = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense
        fallback={
          <main className="route-loading">
            <LoadingIndicator label="Загружаем страницу…" />
          </main>
        }
      >
        <RouteScroll />
        <Routes>
          <Route
            element={
              <PlotsProvider>
                <Outlet />
              </PlotsProvider>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/projects/:slug" element={<Main />} />
          </Route>
          <Route path={adminPath} element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
