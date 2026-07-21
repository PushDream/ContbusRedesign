import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext.jsx";
import Layout from "./Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import MyTicketsPage from "./pages/MyTicketsPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/moje-bilety" element={<MyTicketsPage />} />
            <Route path="/kontakt" element={<ContactPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
