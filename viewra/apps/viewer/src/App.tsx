import { Navigate, Route, Routes } from "react-router-dom";
import { TourPage } from "./pages/TourPage";

function HomePage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl tracking-tight text-mist-100 md:text-6xl">
        Viewra
      </p>
      <p className="mt-4 max-w-sm text-sm font-light text-mist-300">
        Open a tour link to begin a photographic walkthrough.
      </p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tour/:publicId" element={<TourPage />} />
      <Route path="/preview/:token" element={<TourPage mode="preview" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
