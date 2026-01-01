import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get("/api/auth", (c) => {
  const sessionId = "session-" + String(Math.random())
  setCookie(c, "used_id", sessionId)
  return c.text("signed in!")
})

app.get("/api/play", (c) => {
  const roomId = "room-" + String(Math.random())
  return c.json({
    "room_id": roomId
  })
})

app.get("/api/play/:room-id", (c) => {
  const roomId = c.req.param("room-id")
}
)

export default app
