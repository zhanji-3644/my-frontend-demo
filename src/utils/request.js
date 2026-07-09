import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

http.interceptors.response.use(
  response => response.data,
  error => {
    const msg = error.response?.data?.message || error.message || 'Network error'
    console.error(`[Request Error] ${msg}`)
    return Promise.reject(error)
  }
)

export const request = {
  get(url, params) {
    return http.get(url, { params })
  },
  post(url, data) {
    return http.post(url, data)
  },
  put(url, data) {
    return http.put(url, data)
  },
  delete(url) {
    return http.delete(url)
  }
}

export default http
