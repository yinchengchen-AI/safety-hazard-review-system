import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy } from 'react'
import Login from './pages/Login'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const HazardList = lazy(() => import('./pages/Hazard/HazardList'))
const HazardDetail = lazy(() => import('./pages/Hazard/HazardDetail'))
const BatchImport = lazy(() => import('./pages/Batch/BatchImport'))
const BatchHistory = lazy(() => import('./pages/Batch/BatchHistory'))
const TaskList = lazy(() => import('./pages/Task/TaskList'))
const TaskDetail = lazy(() => import('./pages/Task/TaskDetail'))
const Statistics = lazy(() => import('./pages/Statistics/Statistics'))
const UserList = lazy(() => import('./pages/User/UserList'))
const AuditLogList = lazy(() => import('./pages/AuditLog/AuditLogList'))
const NotificationList = lazy(() => import('./pages/Notification/NotificationList'))
const EnterpriseList = lazy(() => import('./pages/Enterprise/EnterpriseList'))
const EnterpriseDetail = lazy(() => import('./pages/Enterprise/EnterpriseDetail'))
import { useUserStore } from './store/userStore'

function App() {
  // The httpOnly auth cookie is invisible to JS. The user store reflects
  // the result of /auth/me: when the cookie is missing or expired the
  // request interceptor redirects to /login and the user store clears.
  const { user, fetchUser } = useUserStore()

  useEffect(() => {
    // Probe /me on mount. If the cookie is valid, the store will populate;
    // if not, the 401 interceptor in api/request.ts handles the redirect.
    fetchUser()
  }, [fetchUser])

  const checkAuth = () => {
    fetchUser()
  }

  const isAuth = !!user

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={checkAuth} />} />
        <Route
          path="/"
          element={isAuth ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="hazards" element={<HazardList />} />
          <Route path="hazards/:id" element={<HazardDetail />} />
          <Route path="batches/import" element={<BatchImport />} />
          <Route path="batches/history" element={<BatchHistory />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="users" element={<UserList />} />
          <Route path="audit-logs" element={<AuditLogList />} />
          <Route path="notifications" element={<NotificationList />} />
          <Route path="enterprises" element={<EnterpriseList />} />
          <Route path="enterprises/:id" element={<EnterpriseDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
