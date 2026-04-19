import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy } from 'react'
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
import { useUserStore } from './store/userStore'

function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'))
  const { fetchUser, clearUser } = useUserStore()

  useEffect(() => {
    const handleStorage = () => {
      const hasToken = !!localStorage.getItem('token')
      setIsAuth(hasToken)
      if (hasToken) {
        fetchUser()
      } else {
        clearUser()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [fetchUser, clearUser])

  useEffect(() => {
    if (isAuth) {
      fetchUser()
    }
  }, [isAuth, fetchUser])

  const checkAuth = () => {
    const hasToken = !!localStorage.getItem('token')
    setIsAuth(hasToken)
    if (hasToken) {
      fetchUser()
    } else {
      clearUser()
    }
  }

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
