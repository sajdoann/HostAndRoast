import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dinners from "./pages/Dinners";
import Host from "./pages/Host";
import NotFound from "./pages/NotFound";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dinners" element={<Dinners />} />
        <Route path="host" element={<Host />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
