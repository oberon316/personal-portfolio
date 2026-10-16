export function MutationFeedback({ message, error }: { message: string; error: string }) {
  return <div aria-live="polite" className="mutation-feedback">
    {message && <p className="form-success" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
