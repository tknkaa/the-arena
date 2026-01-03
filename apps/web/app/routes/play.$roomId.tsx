import type { ClientMessage, ServerMessage } from "@apps/api";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

type ClientBattleState = {
	status: "waiting" | "playing" | "ended";
	elapsedTime: number;
};

export default function Page() {
	const { roomId } = useParams<{ roomId: string }>();
	const socketRef = useRef<WebSocket | null>(null);

	const [battle, setBattle] = useState<ClientBattleState | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<
		"connecting" | "connected" | "disconnected" | "error"
	>("connecting");

	useEffect(() => {
		if (!roomId) return;

		const ws = new WebSocket(`ws://localhost:8787/api/play/${roomId}`);
		socketRef.current = ws;

		ws.addEventListener("open", () => {
			setConnectionStatus("connected");

			let userId = localStorage.getItem("debug-user-id");
			if (!userId) {
				userId = "user-" + Math.random().toString(36).slice(2);
				localStorage.setItem("debug-user-id", userId);
			}

			const ready: ClientMessage = {
				type: "READY",
				userId,
			};

			ws.send(JSON.stringify(ready));
		});

		ws.addEventListener("message", (event) => {
			let data: ServerMessage;
			try {
				data = JSON.parse(event.data);
			} catch {
				return;
			}

			switch (data.type) {
				case "SYNC_STATE":
					setBattle({
						status: data.payload.status,
						elapsedTime: data.payload.elapsedTime,
					});
					break;

				case "GAME_STARTED":
					// optional: SE / animation trigger
					break;

				case "WAITING_FOR_OPPONENT":
					setBattle({
						status: "waiting",
						elapsedTime: 0,
					});
					break;
			}
		});

		ws.addEventListener("close", () => {
			setConnectionStatus("disconnected");
			socketRef.current = null;
		});

		ws.addEventListener("error", () => {
			setConnectionStatus("error");
		});

		return () => {
			ws.close();
		};
	}, [roomId]);

	const elapsedSeconds = battle ? Math.floor(battle.elapsedTime / 1000) : 0;

	return (
		<>
			<div>Status: {connectionStatus}</div>
			<div>Game: {battle?.status ?? "—"}</div>
			<div>Elapsed: {elapsedSeconds}s</div>
		</>
	);
}
