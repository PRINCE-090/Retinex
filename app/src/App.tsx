import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkflowProvider } from './context/WorkflowContext'
import Landing from './pages/Landing'

// Layouts
import PatientLayout from './layouts/PatientLayout'
import TechnicianLayout from './layouts/TechnicianLayout'
import DoctorLayout from './layouts/DoctorLayout'
import AdminLayout from './layouts/AdminLayout'

// Auth Pages
import RoleSelection from './pages/auth/RoleSelection'
import PatientLogin from './pages/auth/PatientLogin'
import DoctorLogin from './pages/auth/DoctorLogin'
import TechnicianLogin from './pages/auth/TechnicianLogin'
import AdminLogin from './pages/auth/AdminLogin'

// Patient Pages
import PatientHome from './pages/patient/PatientHome'
import PatientScans from './pages/patient/PatientScans'
import PatientPrescriptions from './pages/patient/PatientPrescriptions'

// Technician Pages
import TechnicianDashboard from './pages/technician/TechnicianDashboard'
import TechnicianPatientView from './pages/technician/TechnicianPatientView'
import TechnicianHistory from './pages/technician/TechnicianHistory'

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorReviewScreen from './pages/doctor/DoctorReviewScreen'
import DoctorDatabase from './pages/doctor/DoctorDatabase'
import DoctorTemplates from './pages/doctor/DoctorTemplates'

import RequireRole from './components/layout/RequireRole'
import SettingsPage from './pages/shared/SettingsPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminInsights from './pages/admin/AdminInsights'
import AdminStaff from './pages/admin/AdminStaff'
import AdminActivity from './pages/admin/AdminActivity'

export default function App() {
  return (
    <WorkflowProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Auth Routes */}
        <Route path="/login/role-selection" element={<RoleSelection />} />
        <Route path="/login/patient" element={<PatientLogin />} />
        <Route path="/login/doctor" element={<DoctorLogin />} />
        <Route path="/login/technician" element={<TechnicianLogin />} />
        <Route path="/login/admin" element={<AdminLogin />} />
        <Route path="/login" element={<Navigate to="/login/role-selection" replace />} />

        {/* Patient Routes */}
        <Route path="/patient" element={<RequireRole role="patient"><PatientLayout /></RequireRole>}>
          <Route path="settings" element={<SettingsPage role="patient" />} />
          <Route index element={<PatientHome />} />
          <Route path="scans" element={<PatientScans />} />
          <Route path="prescriptions" element={<PatientPrescriptions />} />
        </Route>

        {/* Technician Routes */}
        <Route path="/technician" element={<RequireRole role="technician"><TechnicianLayout /></RequireRole>}>
          <Route path="settings" element={<SettingsPage role="technician" />} />
          <Route index element={<TechnicianDashboard />} />
          <Route path="patient/:patientId" element={<TechnicianPatientView />} />
          <Route path="history" element={<TechnicianHistory />} />
        </Route>

        {/* Doctor Routes */}
        <Route path="/doctor" element={<RequireRole role="doctor"><DoctorLayout /></RequireRole>}>
          <Route path="settings" element={<SettingsPage role="doctor" />} />
          <Route index element={<DoctorDashboard />} />
          <Route path="patients" element={<DoctorDatabase />} />
          <Route path="templates" element={<DoctorTemplates />} />
          <Route path="review/:visitId" element={<DoctorReviewScreen />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
          <Route path="settings" element={<SettingsPage role="admin" />} />
          <Route index element={<AdminDashboard />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="insights" element={<AdminInsights />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </WorkflowProvider>
  )
}
