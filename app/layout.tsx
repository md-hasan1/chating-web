import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { FriendProvider } from "./context/FriendContext";
import { ChatProvider } from "./context/ChatContext";
import { ToastProvider } from "./context/ToastContext";
import ReduxProvider from "./store/ReduxProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatApp",
  description: "Chat application with Google authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ReduxProvider>
          <AuthProvider>
            <ToastProvider>
              <SocketProvider>
                <FriendProvider>
                  <ChatProvider>
                    {children}
                  </ChatProvider>
                </FriendProvider>
              </SocketProvider>
            </ToastProvider>
          </AuthProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
