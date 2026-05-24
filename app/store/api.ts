import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

type AuthTokenArg = { token: string };

type ChatIdArg = { token: string; chatId: string };

type DeleteMessageArg = { token: string; messageId: string; scope: 'me' | 'everyone' };

type CreateChatArg = { token: string; title: string };

type CreateDirectChatArg = { token: string; targetUserId: string };

type CreateMessageArg = { token: string; content: string; chatId: string; role?: 'user' | 'assistant' };

type UploadFileArg = { token: string; file: File; chatId: string; clientMessageId: string };

type UpdateProfileArg = { token: string; name: string };

type GoogleLoginArg = { email: string; name: string; googleId: string; image: string };

type EmailLoginArg = { email: string; password: string };

type RegisterArg = { email: string; password: string; name: string };

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  }),
  tagTypes: ['Auth', 'Chat', 'Users', 'Friend', 'Message'],
  endpoints: (builder) => ({
    authMe: builder.query<any, AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Auth'],
    }),
    googleLogin: builder.mutation<any, GoogleLoginArg>({
      query: (body) => ({
        url: '/api/auth/google-login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),
    guestLogin: builder.mutation<any, void>({
      query: () => ({
        url: '/api/auth/guest-login',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
    emailLogin: builder.mutation<any, EmailLoginArg>({
      query: (body) => ({
        url: '/api/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),
    register: builder.mutation<any, RegisterArg>({
      query: (body) => ({
        url: '/api/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),
    updateProfile: builder.mutation<any, UpdateProfileArg>({
      query: ({ token, name }) => ({
        url: '/api/users/profile',
        method: 'PUT',
        body: { name },
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Auth', 'Users'],
    }),

    getChats: builder.query<any[], AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/chat',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Chat'],
    }),
    getChatById: builder.query<any, ChatIdArg>({
      query: ({ token, chatId }) => ({
        url: `/api/chat/${chatId}`,
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: (_res, _err, arg) => [{ type: 'Chat', id: arg.chatId }],
    }),
    createChat: builder.mutation<any, CreateChatArg>({
      query: ({ token, title }) => ({
        url: '/api/chat',
        method: 'POST',
        body: { title },
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Chat'],
    }),
    createDirectChat: builder.mutation<any, CreateDirectChatArg>({
      query: ({ token, targetUserId }) => ({
        url: '/api/chat/direct',
        method: 'POST',
        body: { targetUserId },
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Chat'],
    }),
    deleteChat: builder.mutation<any, ChatIdArg>({
      query: ({ token, chatId }) => ({
        url: `/api/chat/${chatId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Chat'],
    }),

    getUsers: builder.query<any[], AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/users',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Users'],
    }),

    createMessage: builder.mutation<any, CreateMessageArg>({
      query: ({ token, content, chatId, role }) => ({
        url: '/api/message',
        method: 'POST',
        body: { content, chatId, role },
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Message', 'Chat'],
    }),
    uploadFile: builder.mutation<any, UploadFileArg>({
      query: ({ token, file, chatId, clientMessageId }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chatId', chatId);
        formData.append('clientMessageId', clientMessageId);

        return {
          url: '/api/message/upload',
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        };
      },
      invalidatesTags: ['Message', 'Chat'],
    }),
    deleteMessage: builder.mutation<any, DeleteMessageArg>({
      query: ({ token, messageId, scope }) => ({
        url: `/api/message/${messageId}?scope=${scope}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      invalidatesTags: ['Message', 'Chat'],
    }),

    getFriends: builder.query<any[], AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/friend/list',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Friend'],
    }),
    getPendingRequests: builder.query<any[], AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/friend/pending',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Friend'],
    }),
    getSentRequests: builder.query<any[], AuthTokenArg>({
      query: ({ token }) => ({
        url: '/api/friend/sent',
        headers: { Authorization: `Bearer ${token}` },
      }),
      providesTags: ['Friend'],
    }),
  }),
});

export const {
  useAuthMeQuery,
  useGoogleLoginMutation,
  useGuestLoginMutation,
  useEmailLoginMutation,
  useRegisterMutation,
  useUpdateProfileMutation,
  useGetChatsQuery,
  useGetChatByIdQuery,
  useCreateChatMutation,
  useCreateDirectChatMutation,
  useDeleteChatMutation,
  useGetUsersQuery,
  useCreateMessageMutation,
  useUploadFileMutation,
  useDeleteMessageMutation,
  useGetFriendsQuery,
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
} = api;
