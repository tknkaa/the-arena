import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { cors } from "hono/cors";

type BattleState = {
	status: "waiting" | "playing" | "ended";
	startTime?: number;
	elapsedTime: number;
	userIds?: string[];
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
	addUser(userId: string) {
		if (!this.state.userIds) {
			this.state.userIds = [];
		}
		if (!this.state.userIds?.includes(userId)) {
			this.state.userIds.push(userId);
		}
		return this.state.userIds.length;
	}
}

export class BattleActor extends DurableObject<Bindings> {
	private engine: BattleEngine;
	constructor(ctx: DurableObjectState, env: Bindings) {
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
			const userId = data.userId;
			const numOfUsers = this.engine.addUser(userId);

			const allSessions = this.ctx.getWebSockets();
			if (numOfUsers === 2) {
				this.engine.start();
				this.ctx.storage.setAlarm(Date.now() + 1000);
				// Notify all clients that the game has started
				const startMessage = JSON.stringify({ type: "GAME_STARTED" });
				allSessions.forEach((socket) => {
					socket.send(startMessage);
				});
				this.broadcastState();
			} else {
				ws.send(JSON.stringify({ type: "WAITING_FOR_OPPONENT" }));
			}
		}
	}

	async alarm() {
		let scheduledTime = await this.ctx.storage.get<number>("nextTickTime");
		if (!scheduledTime) {
			scheduledTime = Date.now();
		}
		const nextTickTime = scheduledTime + 1000;
		const state = this.engine.tick();
		this.broadcastState();

		if (state.status === "playing") {
			await this.ctx.storage.put("nextTickTime", nextTickTime);
			this.ctx.storage.setAlarm(nextTickTime);
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
	//TODO: add webSocketClose and webSocketError
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
