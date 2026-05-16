import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import AuthCallback from "./pages/AuthCallback";
import CreateCircle from "./pages/CreateCircle";
import CreateSolo from "./pages/CreateSolo";
import JoinCircle from "./pages/JoinCircle";
import Reads from "./pages/Reads";
import Turns from "./pages/Turns";
import Personal from "./pages/Personal";
import Reader from "./pages/Reader";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-[#A8A5A1] font-serif italic">
        …
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function Router() {
  const location = useLocation();
  // Process Emergent OAuth fragment synchronously during render
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/join" element={<JoinCircle />} />
      <Route path="/join/:code" element={<JoinCircle />} />
      <Route
        path="/create-circle"
        element={
          <Protected>
            <CreateCircle />
          </Protected>
        }
      />
      <Route
        path="/create-solo"
        element={
          <Protected>
            <CreateSolo />
          </Protected>
        }
      />
      <Route
        path="/app/reads"
        element={
          <Protected>
            <Reads />
          </Protected>
        }
      />
      <Route
        path="/app/turns"
        element={
          <Protected>
            <Turns />
          </Protected>
        }
      />
      <Route
        path="/app/personal"
        element={
          <Protected>
            <Personal />
          </Protected>
        }
      />
      <Route
        path="/read/:bookId"
        element={
          <Protected>
            <Reader />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#FCFBF9",
              color: "#2C2A29",
              border: "1px solid #EAE6E1",
              fontFamily: "Manrope, sans-serif",
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
