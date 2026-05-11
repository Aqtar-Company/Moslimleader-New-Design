// Catalog is a completely standalone experience — no site header, footer, or chat widgets.
// We use a fixed full-screen shell with a high z-index to cover all root-layout elements.
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="catalog-shell"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#1a1a2e', overflowY: 'auto', overflowX: 'hidden' }}
    >
      {children}
    </div>
  );
}
