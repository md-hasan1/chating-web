import { io } from "socket.io-client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length < 2) {
    console.log("Not enough users to test.");
    return;
  }
  const user1 = users[0];
  const user2 = users[1];

  console.log(`Testing with User 1: ${user1.id} and User 2: ${user2.id}`);

  const socket1 = io("http://localhost:5000");
  const socket2 = io("http://localhost:5000");

  socket1.on("connect", () => {
    console.log("Socket 1 connected");
    socket1.emit("user:login", user1.id);
    
    // Wait a bit, then send friend request
    setTimeout(() => {
      console.log("Socket 1 sending friend request to User 2");
      socket1.emit("friend:request:send", { targetUserId: user2.id });
    }, 1000);
  });

  socket1.on("friend:request:sent", (data) => {
    console.log("Socket 1 received friend:request:sent:", data);
  });

  socket1.on("friend:request:error", (error) => {
    console.error("Socket 1 error:", error);
  });

  socket1.on("friend:rejected", (data) => {
    console.log("Socket 1 received friend:rejected:", data);
    process.exit(0);
  });

  socket2.on("connect", () => {
    console.log("Socket 2 connected");
    socket2.emit("user:login", user2.id);
  });

  socket2.on("friend:request:received", (data) => {
    console.log("Socket 2 received friend:request:received:", data);
    // Reject it!
    setTimeout(() => {
      console.log("Socket 2 rejecting request ID:", data.id);
      socket2.emit("friend:request:reject", { requestId: data.id });
    }, 1000);
  });
  
  socket2.on("friend:request:error", (error) => {
    console.error("Socket 2 error:", error);
  });

  socket2.on("friend:rejected", (data) => {
    console.log("Socket 2 received friend:rejected:", data);
  });
}

run();
