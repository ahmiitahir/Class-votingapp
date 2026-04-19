export function isAdminAuthenticated() {
  return sessionStorage.getItem("farewell_admin_ok") === "true";
}
