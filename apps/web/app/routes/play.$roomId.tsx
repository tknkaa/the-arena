import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

export default function Page() {
	const [startTime, setStartTime] = useState(0);
	const [elapsedTime, setElapsed] = useState(0);
	const { roomId } = useParams();
	const socketRef = useRef<WebSocket | null>(null);
	useEffect(() => {
		const websocket = new WebSocket(`ws://localhost:8787/api/play/${roomId}`);
		socketRef.current = websocket;

		const onMessage = (event: MessageEvent) => {
			const data = JSON.parse(event.data);
			if (data.type === "SYNC_STATE") {
				const startTime = data.payload.startTime;
				if (typeof startTime === "number") {
					setStartTime(startTime);
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
			setElapsed(elapsedTime);
		}, 16);

		return () => {
			clearInterval(timerId);
		};
	});
	return (
		<>
			<div>Elapsed: {elapsedTime}</div>
		</>
	);
}
