import { createRoot } from "react-dom/client";
import { AdminApp } from "./AdminApp";

const root = document.getElementById("root");
if (!root) throw new Error("The admin page is missing #root. Run npm run build:admin again.");
createRoot(root).render(<AdminApp />);
