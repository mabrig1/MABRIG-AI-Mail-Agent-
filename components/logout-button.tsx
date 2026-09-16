export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="ghost-button" type="submit">Sign out</button>
    </form>
  )
}
