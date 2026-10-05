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

import "./styles/global.css";
import "./App.css";

const Main = lazy(() =>
  import("./pages/Main").then((module) => ({ default: module.Main })),
);
const Admin = lazy(() =>
  import("./pages/Admin").then((module) => ({ default: module.Admin })),
);

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
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
