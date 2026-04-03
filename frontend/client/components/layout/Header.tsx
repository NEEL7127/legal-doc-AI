import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const isUpload = location.pathname === "/upload";
  const isChat = location.pathname === "/chat";

  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg">
          LegalDoc AI
        </div>

        <nav className="flex gap-3 items-center">
          <Link
            to="/upload"
            className={[
              "px-3 py-2 rounded-md text-sm",
              isUpload ? "bg-primary/10 text-primary" : "text-foreground/70",
            ].join(" ")}
          >
            Upload
          </Link>
          <Link
            to="/chat"
            className={[
              "px-3 py-2 rounded-md text-sm",
              isChat ? "bg-primary/10 text-primary" : "text-foreground/70",
            ].join(" ")}
          >
            Chat
          </Link>
        </nav>
      </div>
    </header>
  );
}

