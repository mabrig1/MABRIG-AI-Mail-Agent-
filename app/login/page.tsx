import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getAdminSession } from '@/lib/auth-server'

export default async function LoginPage() {
  if (await getAdminSession()) redirect('/dashboard')

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">MABRIG TECHNOLOGIES</p>
        <h1>Admin access</h1>
        <p className="lede">Secure access to the MABRIG AI Mail Agent control room.</p>
        <LoginForm />
      </section>
    </main>
  )
}
