import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Layout from './components/Layout'
import HazardList from './pages/Hazard/HazardList'
import HazardDetail from './pages/Hazard/HazardDetail'
import BatchImport from './pages/Batch/BatchImport'
import BatchHistory from './pages/Batch/BatchHistory'
import TaskList from './pages/Task/TaskList'
import TaskDetail from './pages/Task/TaskDetail'
import Statistics from './pages/Statistics/Statistics'
import UserList from './pages/User/UserList'
import Dashboard from './pages/Dashboard/Dashboard'
import AuditLogList from './pages/AuditLog/AuditLogList'
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
