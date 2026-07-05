export function LoadingScreen({
  message = "Loading your study workspace...",
}: {
  message?: string;
}) {
  return (
    <div
      className="reader-catalog reader-loading-screen"
      aria-busy="true"
    >
      <header className="reader-loading-masthead" aria-hidden="true">
        <div>
          <strong>Capybara Coach</strong>
          <span>Reading room · circulation desk</span>
        </div>
        <p>
          <i /> Desk open
        </p>
      </header>

      <div className="reader-loading-desk">
        <div className="reader-loading-wrap">
          <div className="reader-auth-capy reader-loading-capy" aria-hidden="true">
            <i />
            <i />
            <span>
              <b />
              <b />
              <em />
            </span>
          </div>

          <section className="reader-loading-card">
            <div className="reader-loading-tab" aria-hidden="true">
              Request pending
            </div>
            <header aria-hidden="true">
              <span>Reading room request</span>
              <span>Form 42-L</span>
            </header>

            <div className="reader-loading-card-body">
              <div className="reader-loading-stamp" aria-hidden="true">
                Processing
              </div>
              <p className="reader-overline" aria-hidden="true">
                Circulation desk · please wait
              </p>
              <p
                className="reader-loading-message"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {message}
              </p>
              <p className="reader-loading-copy">
                Your place is marked. We&apos;re pulling the right cards from the drawer.
              </p>

              <div className="reader-loading-progress" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <footer aria-hidden="true">
              <span>Read · recall · assess · file · drill</span>
              <span>Filed automatically</span>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}
