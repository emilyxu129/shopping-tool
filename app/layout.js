import "./globals.css";

export const metadata = {
  title: "Shopping Tool",
  description: "Track product prices and stock changes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
