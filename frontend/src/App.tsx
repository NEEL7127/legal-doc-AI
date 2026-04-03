import { Navigate, Route, Routes } from "react-router-dom";
import UploadDocuments from "../pages/UploadDocuments";
import ChatDocuments from "../pages/ChatDocuments";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<UploadDocuments />} />
      <Route path="/chat" element={<ChatDocuments />} />
      <Route path="*" element={<Navigate to="/upload" replace />} />
    </Routes>
  );
}

