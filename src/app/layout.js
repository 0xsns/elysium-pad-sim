import "./globals.css";

export const metadata = {
  title: "Elysium Pad Sim — $10 paper trading",
  description:
    "Paper-trading simulator for the three busiest Elysium launchpads (Montra, Ascend, Volta). Real Uniswap v4 pool candles, $10 bankroll, no wallet needed.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
