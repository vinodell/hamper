/** Remove credentials retained by the former Basic-auth implementation. */
export function clearLegacyAdminAuthorization() {
  try {
    window.sessionStorage.removeItem("hamper.adminAuthorization");
  } catch {
    // Authentication uses the server's HttpOnly cookie even if storage is blocked.
  }
}
