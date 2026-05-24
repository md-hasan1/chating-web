export const activeUsers = new Map<string, string>(); // userId -> socketId
export const callRooms = new Map<string, Set<string>>(); // roomId -> Set<socketIds>
export const visibleUsers = new Set<string>(); // userIds of those actively focusing the tab
