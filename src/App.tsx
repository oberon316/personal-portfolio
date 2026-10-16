import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { PortfolioPage } from './pages/PortfolioPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { ProfilePage } from './pages/admin/ProfilePage'
import { SkillsPage } from './pages/admin/SkillsPage'
import { ProjectsPage } from './pages/admin/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { SettingsPage } from './pages/admin/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout source="published" />}>
          <Route index element={<PortfolioPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
        </Route>
        <Route path="preview" element={<PublicLayout source="draft" />}>
          <Route index element={<PortfolioPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
