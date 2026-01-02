import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

export default function Page() {
	const [startTime, setStartTime] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const { roomId } = useParams();
	const socketRef = useRef<WebSocket | null>(null);
	useEffect(() => {
		const websocket = new WebSocket(`ws://localhost:8787/api/play/${roomId}`);
		socketRef.current = websocket;

		const onMessage = (event: MessageEvent) => {
			let data: any;
			try {
				data = JSON.parse(event.data);
			} catch (error) {
				console.error("Failed to parse WebSocket message", error, event.data);
				return;
			}
			if (data.type === "SYNC_STATE") {
				const receivedStartTime = data.payload.startTime;
				if (typeof receivedStartTime === "number") {
					setStartTime(receivedStartTime);
				}
			}
		};
		websocket.addEventListener("message", onMessage);
		return () => {
			websocket.close();
			websocket.removeEventListener("message", onMessage);
		};
	}, [roomId]);
	useEffect(() => {
		const timerId = setInterval(() => {
			const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
			setElapsedTime(elapsedTime);
		}, 1000);

		return () => {
			clearInterval(timerId);
		};
	}, [startTime]);
	return (
		<>
			<div>Elapsed: {elapsedTime}</div>
		</>
	);
}
