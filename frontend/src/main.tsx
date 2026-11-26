import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import "./index.css";
import AuthorsPage from "./pages/Authors";
import CatalogPage from "./pages/Catalog";
import HistoryPage from "./pages/History";
import HomePage from "./pages/Home";
import StoryPage from "./pages/Story";
import TitleSearchPage from "./pages/TitleSearch";

const PerformancePage = lazy(() => import("./pages/Performance"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="title" element={<TitleSearchPage />} />
          <Route path="authors" element={<AuthorsPage />} />
          <Route path="story" element={<StoryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="performance" element={<Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><PerformancePage /></Suspense>} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
