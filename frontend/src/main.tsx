import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import "./index.css";
import AuthorsPage from "./pages/Authors";
import BookPage from "./pages/Book";
import CatalogPage from "./pages/Catalog";
import HistoryPage from "./pages/History";
import HomePage from "./pages/Home";
import StoryPage from "./pages/Story";
import TitleSearchPage from "./pages/TitleSearch";


function NotFound() {
  return (
    <div className="max-w-xl">
      <h1 className="text-[2rem] text-chalk">That page isn't in the catalogue</h1>
      <p className="mt-3 text-sage">The address may be mistyped. <a href="/" className="text-chalk underline">Go to the front desk</a>.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="plot" element={<StoryPage />} />
          <Route path="title" element={<TitleSearchPage />} />
          <Route path="authors" element={<AuthorsPage />} />
          <Route path="catalogue" element={<CatalogPage />} />
          <Route path="book/:id" element={<BookPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="story" element={<Navigate to="/plot" replace />} />
          <Route path="catalog" element={<Navigate to="/catalogue" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
