/**
 * Format last active time to a human-readable string
 * @param lastActiveAt - ISO date string or Date object
 * @returns Formatted string like "5 minutes ago", "2 hours ago", "Yesterday", "May 20", etc.
 */
export const formatLastActive = (lastActiveAt: string | Date | null | undefined): string => {
  if (!lastActiveAt) {
    return 'Never active';
  }

  const date = typeof lastActiveAt === 'string' ? new Date(lastActiveAt) : lastActiveAt;
  const now = new Date();
  
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
                  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && 
                      date.getMonth() === yesterday.getMonth() && 
                      date.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    return `Today at ${timeString}`;
  }
  
  if (isYesterday) {
    return `Yesterday at ${timeString}`;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();

  if (date.getFullYear() !== now.getFullYear()) {
    return `${month} ${day}, ${date.getFullYear()} at ${timeString}`;
  }

  return `${month} ${day} at ${timeString}`;
};
