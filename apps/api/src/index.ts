import { DurableObject } from "cloudflare:workers";
import { type Env, Hono } from "hono";
import { cors } from "hono/cors";

type BattleState = {
	status: "waiting" | "playing" | "ended";
	startTime?: number;
	elapsedTime: number;
};

class BattleEngine {
	private state: BattleState;

	constructor() {
		this.state = {
			status: "waiting",
			elapsedTime: 0,
		};
	}

	start() {
		this.state.status = "playing";
		this.state.startTime = Date.now();
	}

	tick() {
		if (this.state.status === "playing" && this.state.startTime) {
			this.state.elapsedTime = Date.now() - this.state.startTime;
		}
		return this.state;
	}

	getState() {
		return this.state;
	}
}

export class BattleActor extends DurableObject<Env> {
	private engine: BattleEngine;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.engine = new BattleEngine();
	}
	async fetch(request: Request) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
	async webSocketMessage(ws: WebSocket, message: string) {
		let data: any;

		try {
			data = JSON.parse(message);
		} catch (error) {
			console.error("Failed to parse WebSocket message as JSON", error);
			ws.close(1003, "Invalid JSON");
			return;
		}

		if (data.type === "READY") {
			this.engine.start();
			this.ctx.storage.setAlarm(Date.now() + 1000);
			this.broadcastState();
		}
	}

	async alarm() {
		const state = this.engine.tick();
		this.broadcastState();

		if (state.status === "playing") {
			this.ctx.storage.setAlarm(Date.now() + 1000);
		}
	}

	private broadcastState() {
		const payload = JSON.stringify({
			type: "SYNC_STATE",
			payload: this.engine.getState(),
		});

		this.ctx.getWebSockets().forEach((ws) => {
			ws.send(payload);
		});
	}
}

type Bindings = {
	DO: DurableObjectNamespace<BattleActor>;
};

const app = new Hono<{ Bindings: Bindings }>();

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

app.get("/api/play/:room-id", async (c) => {
	const roomId = c.req.param("room-id");
	const env = c.env;
	const id = env.DO.idFromName(roomId);
	const stub = env.DO.get(id);
	return stub.fetch(c.req.raw);
});

export default app;
