import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

export default function Page() {
	const [message, setMessage] = useState("");
	const { roomId } = useParams();
	const socketRef = useRef<WebSocket | null>(null);
	useEffect(() => {
		const websocket = new WebSocket(`ws://localhost:8787/api/play/${roomId}`);
		socketRef.current = websocket;

		const onMessage = (event: MessageEvent) => {
			setMessage(event.data);
		};
		websocket.addEventListener("message", onMessage);
		return () => {
			websocket.close();
			websocket.removeEventListener("message", onMessage);
		};
	}, []);
	return (
		<>
			<div>{message}</div>
			<button
				onClick={() => {
					socketRef.current?.send("Hello from client");
				}}
			>
				send
			</button>
		</>
	);
}
