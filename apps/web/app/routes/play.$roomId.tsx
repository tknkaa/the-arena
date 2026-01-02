import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

export default function Page() {
	const [elapsedTime, setElapsedTime] = useState(0);
	const { roomId } = useParams();
	const socketRef = useRef<WebSocket | null>(null);

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
			if (data.type === "SYNC_STATE") {
				const receivedElapsedTime = data.payload.elapsedTime;
				if (typeof receivedElapsedTime === "number") {
					// Sync with authoritative server value
					setElapsedTime(Math.floor(receivedElapsedTime / 1000));
				}
			}
		};
		websocket.addEventListener("message", onMessage);
		websocket.addEventListener("open", () => {
			const readyMessage = {
				type: "READY",
			};
			websocket.send(JSON.stringify(readyMessage));
			console.log("Connected");
		});
		return () => {
			websocket.close();
			websocket.removeEventListener("message", onMessage);
		};
	}, [roomId]);

	// Client-side ticker
	useEffect(() => {
		const timerId = setInterval(() => {
			setElapsedTime((prev) => prev + 1);
		}, 1000);

		return () => {
			clearInterval(timerId);
		};
	}, []);

	return (
		<>
			<div>Elapsed: {elapsedTime}</div>
		</>
	);
}
