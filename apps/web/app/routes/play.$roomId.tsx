import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

export default function Page() {
	const [elapsedTime, setElapsedTime] = useState(0);
	const [gameStarted, setGameStarted] = useState(false);
	const elapsedTimeRef = useRef(0);
	const { roomId } = useParams();
	const socketRef = useRef<WebSocket | null>(null);
	const isFirstSync = useRef(true);

	useEffect(() => {
		const websocket = new WebSocket(`ws://localhost:8787/api/play/${roomId}`);
		socketRef.current = websocket;

		const onMessage = (event: MessageEvent) => {
			console.log("Received message", event.data);
			let data: any;
			try {
				data = JSON.parse(event.data);
			} catch (error) {
				console.error("Failed to parse WebSocket message", error, event.data);
				return;
			}
			if (data.type === "GAME_STARTED") {
				setGameStarted(true);
			} else if (data.type === "SYNC_STATE") {
				if (data.payload.status === "playing") {
					setGameStarted(true);
				}
				const receivedElapsedTime = data.payload.elapsedTime;
				if (typeof receivedElapsedTime === "number") {
					const receivedElapsedSeconds = Math.floor(receivedElapsedTime / 1000);
					if (
						isFirstSync.current ||
						Math.abs(receivedElapsedSeconds - elapsedTimeRef.current) >= 1
					) {
						// Sync with authoritative server value
						const syncedValue = Math.floor(receivedElapsedTime / 1000);
						setElapsedTime(syncedValue);
						elapsedTimeRef.current = syncedValue;
						isFirstSync.current = false;
					}
				}
			}
		};
		websocket.addEventListener("message", onMessage);
		websocket.addEventListener("open", () => {
			let userId = localStorage.getItem("debug-user-id");
			if (!userId) {
				userId = "user-" + Math.random().toString(36).substring(7);
				localStorage.setItem("debug-user-id", userId);
			}
			const readyMessage = {
				type: "READY",
				userId: userId,
			};
			websocket.send(JSON.stringify(readyMessage));
			console.log("Connected");
		});
		websocket.addEventListener("error", (_event) => {
			//TODO: error handling
		});
		return () => {
			websocket.close();
			websocket.removeEventListener("message", onMessage);
		};
	}, [roomId]);

	// Client-side ticker
	useEffect(() => {
		if (!gameStarted) return;

		const timerId = setInterval(() => {
			setElapsedTime((prev) => {
				const newValue = prev + 1;
				elapsedTimeRef.current = newValue;
				return newValue;
			});
		}, 1000);

		return () => {
			clearInterval(timerId);
		};
	}, [gameStarted]);

	return (
		<>
			<div>Elapsed: {elapsedTime}</div>
		</>
	);
}
