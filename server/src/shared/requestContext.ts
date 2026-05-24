let currentRequestUserId: string | null = null;

export const setRequestUserId = (userId: string) => {
  currentRequestUserId = userId;
};

export const getRequestUserId = () => currentRequestUserId;
