import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { use } from "hono/jsx";

type BattleState = {
	status: "waiting" | "playing" | "ended";
	startTime?: number;
	elapsedTime: number;
	userIds: string[];
};

export type ClientMessage = {
	type: "READY";
	userId: string;
};

export type ServerMessage =
	| {
			type: "SYNC_STATE";
			payload: BattleState;
	  }
	| {
			type: "WAITING_FOR_OPPONENT";
	  }
	| {
			type: "GAME_STARTED";
	  };

class BattleEngine {
	private state: BattleState;

	constructor() {
		this.state = {
			status: "waiting",
			elapsedTime: 0,
			userIds: [],
		};
	}

	start() {
		this.state.status = "playing";
		this.state.startTime = Date.now();
	}

	restore(savedState: BattleState) {
		this.state = savedState;
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
		if (!this.state.userIds.includes(userId)) {
			this.state.userIds.push(userId);
		}
		return this.state.userIds.length;
	}
	deleteUser(userId: string) {
		if (this.state.userIds.includes(userId)) {
			const deleted = this.state.userIds.filter((id) => id !== userId);
			this.state.userIds = deleted;
		}
	}
}

export class BattleActor extends DurableObject<Bindings> {
	private engine: BattleEngine;
	private sessions: Map<WebSocket, string>;
	constructor(ctx: DurableObjectState, env: Bindings) {
		super(ctx, env);
		this.engine = new BattleEngine();
		this.sessions = new Map<WebSocket, string>();

		this.ctx.blockConcurrencyWhile(async () => {
			const saved = await this.ctx.storage.get<BattleState>("battle_state");
			if (saved) {
				this.engine.restore(saved);
			}
		});
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
		let data: ClientMessage;

		try {
			data = JSON.parse(message);
		} catch (error) {
			console.error("Failed to parse WebSocket message as JSON", error);
			ws.close(1003, "Invalid JSON");
			return;
		}

		if (data.type === "READY") {
			const userId = data.userId;
			this.sessions.set(ws, userId);
			const numOfUsers = this.engine.addUser(userId);

			// Save state after adding any user
			try {
				await this.ctx.storage.put("battle_state", this.engine.getState());
			} catch (error) {
				console.error("Failed to persist state after adding user:", error);
			}

			const allSessions = this.ctx.getWebSockets();
			if (numOfUsers === 2) {
				this.engine.start();
				this.ctx.storage.setAlarm(Date.now() + 1000);
				// Notify all clients that the game has started
				const message: ServerMessage = {
					type: "GAME_STARTED",
				};
				const startMessage = JSON.stringify(message);
				allSessions.forEach((socket) => {
					socket.send(startMessage);
				});
				this.broadcastState();
				try {
					await this.ctx.storage.put("battle_state", this.engine.getState());
				} catch (error) {
					console.error("Failed to persist state after game start:", error);
				}
			} else {
				const message: ServerMessage = {
					type: "WAITING_FOR_OPPONENT",
				};
				ws.send(JSON.stringify(message));
			}
		}
	}

	async alarm() {
		let scheduledTime = await this.ctx.storage.get<number>("nextTickTime");
		if (!scheduledTime) {
			scheduledTime = Date.now();
		}

		const state = this.engine.tick();
		this.broadcastState();

		if (state.status === "playing") {
			// Calculate next tick time to prevent drift
			const nextTickTime = scheduledTime + 1000;
			const now = Date.now();

			// If we're behind, catch up to the next interval
			const adjustedNextTick = nextTickTime < now ? now + 1000 : nextTickTime;

			try {
				await this.ctx.storage.put("battle_state", state);
				await this.ctx.storage.put("nextTickTime", adjustedNextTick);
				this.ctx.storage.setAlarm(adjustedNextTick);
			} catch (error) {
				console.error("Failed to persist state during alarm:", error);
			}
		}
	}

	private broadcastState() {
		const message: ServerMessage = {
			type: "SYNC_STATE",
			payload: this.engine.getState(),
		};

		const syncMessage = JSON.stringify(message);

		this.ctx.getWebSockets().forEach((ws) => {
			ws.send(syncMessage);
		});
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		console.log(`WebSocket closed: code=${code}, reason=${reason}`);
		const state = this.engine.getState();
		const userId = this.sessions.get(ws);
		if (userId) {
			this.engine.deleteUser(userId);
		}

		this.sessions.delete(ws);

		// If the game is playing and a player disconnects, end the game
		if (state.status === "playing") {
			state.status = "ended";
			try {
				await this.ctx.storage.put("battle_state", state);
			} catch (error) {
				console.error("Failed to persist state after disconnect:", error);
			}
			this.broadcastState();
		}
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("WebSocket error:", error);
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
