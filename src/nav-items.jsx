import { MessageSquareIcon } from "lucide-react";
import ChatPage from "./pages/ChatPage.jsx";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Chat",
    to: "/",
    icon: <MessageSquareIcon className="h-4 w-4" />,
    page: <ChatPage />,
  },
];
