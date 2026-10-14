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

import "./styles/global.css";
import "./App.css";

const Main = lazy(() =>
  import("./pages/Main").then((module) => ({ default: module.Main })),
);
const Admin = lazy(() =>
  import("./pages/Admin").then((module) => ({ default: module.Admin })),
);

// TODO: сделать тумблер на включение ленты со скидкой/акцией и динамическая цифра по скидке
// на таблице popup с кадастровым номером/получен ГПЗУ/разрешение на строительство и другой инфой по участку (а там уже кнопка забронировать) 
// сделать анализ по нейрику на текущий сайт
// чекбокс на обработку персональных данных
// наклейку на стоимость (стоимость при 100% оплате)
// на мобилке сделать "построить маршрут" к массиву
// кнопка купить в ипотеку - redirect на объяву в сбере

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
