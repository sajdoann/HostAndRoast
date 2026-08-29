import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import NewSeason from "./pages/NewSeason";
import Season from "./pages/Season";
import EventDay from "./pages/EventDay";
import Join from "./pages/Join";
import Results from "./pages/Results";
import NotFound from "./pages/NotFound";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="new" element={<NewSeason />} />
        <Route path="season/:id" element={<Season />} />
        <Route path="season/:id/results" element={<Results />} />
        <Route path="event/:id" element={<EventDay />} />
        <Route path="join/:code" element={<Join />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
