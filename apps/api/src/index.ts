import { Hono } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { cors } from "hono/cors";

const app = new Hono();

app.use(
	"/api/*",
	cors({
		origin: "http://localhost:5173",
	}),
);

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/api/play", (c) => {
	//TODO: matching
	const roomId = "room-test";
	return c.text(roomId);
});

app.get(
	"/api/play/:room-id",
	upgradeWebSocket((c) => {
		const roomId = c.req.param("room-id");
		return {
			onMessage(event, ws) {
				ws.send(`Hello from room ${roomId}, Received: ${event.data}`);
			},
			onClose: () => {},
		};
	}),
);

export default app;
