export function LoadingScreen({
  message = "Loading your study workspace...",
}: {
  message?: string;
}) {
  return (
    <div className="reader-catalog reader-loading-screen" aria-busy="true">
      <main className="reader-loading-stage">
        <div className="reader-loading-brand" aria-hidden="true">
          <span>CC</span>
          <div><strong>Capybara Coach</strong><small>Reading room</small></div>
        </div>
        <section className="reader-loading-panel">
          <div className="reader-loading-status" aria-hidden="true"><i /> Preparing workspace</div>
          <h1 role="status" aria-live="polite" aria-atomic="true">{message}</h1>
          <p>Your place is saved. This screen will clear as soon as the workspace is ready.</p>
          <div className="reader-loading-bar" role="progressbar" aria-label={message}>
            <i />
          </div>
          <footer aria-hidden="true"><span>Read</span><span>Recall</span><span>Assess</span><span>Review</span></footer>
        </section>
      </main>
    </div>
  );
}
