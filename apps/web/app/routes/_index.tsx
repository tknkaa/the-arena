import { useState } from "react";
import { useNavigate } from "react-router";

export default function Page() {
	const navigate = useNavigate();
	const [isWaiting, setIsWaiting] = useState(false);
	// user is added to the queue
	const getRoomId = async () => {
		setIsWaiting(true);
		const sleep = (time: number) =>
			new Promise((resolve) => setTimeout(resolve, time)); //timeはミリ秒
		await sleep(2000);
		const res = await fetch("http://localhost:8787/api/play");
		const roomId = await res.text();
		navigate(`/play/${roomId}`);
	};
	return (
		<>
			{isWaiting ? (
				<>waiting...</>
			) : (
				<button type="button" onClick={getRoomId}>
					Play
				</button>
			)}
		</>
	);
}
