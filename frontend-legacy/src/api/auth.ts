import request from './request'

export const login = (username: string, password: string) => {
  const params = new URLSearchParams()
  params.append('username', username)
  params.append('password', password)
  return request.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export const getMe = () => request.get('/auth/me')

// The server sets the httpOnly auth cookie on /auth/login and clears it on
// /auth/logout. The browser attaches the cookie automatically, so the SPA
// only needs to call this so the Layout can clear local user state.
export const logout = () => request.post('/auth/logout')
