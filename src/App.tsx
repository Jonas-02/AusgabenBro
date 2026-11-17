// Vorlaeufiges Geruest fuer den ersten Deploy. Wird in Schritt 5 ersetzt.
export function App() {
  return (
    <main style={{ padding: 'calc(var(--page-top) + var(--safe-top)) var(--page-x) 0' }}>
      <p style={{ fontSize: 22 }}>AusgabenBro</p>
      <p style={{ fontSize: 22, color: 'var(--c-accent)' }}>wird gebaut</p>
      <p className="num" style={{ fontSize: 32, marginTop: 20 }}>76,43 €</p>
    </main>
  );
}
