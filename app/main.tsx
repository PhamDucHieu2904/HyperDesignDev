import { hydrateRoot } from "react-dom/client";
import HomePage from "./page";
import { startAnalytics } from './analytics';

const root = document.getElementById("root");
if (!root) throw new Error("The static page is missing #root. Run npm run build again.");
hydrateRoot(root, <HomePage />);
startAnalytics();
