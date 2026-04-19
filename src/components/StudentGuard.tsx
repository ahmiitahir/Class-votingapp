import { Navigate, Outlet } from "react-router-dom";
import { isStudentAuthenticated } from "../utils/auth";

function StudentGuard() {
  if (!isStudentAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default StudentGuard;
