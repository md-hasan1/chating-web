import { Response } from 'express';

interface SendResponseOptions<T = any> {
  statusCode: number;
  success: boolean;
  message?: string;
  data?: T;
}

const sendResponse = (res: Response, options: SendResponseOptions) => {
  const { statusCode, success, message, data } = options;
  return res.status(statusCode).json({ success, message, data });
};

export default sendResponse;
