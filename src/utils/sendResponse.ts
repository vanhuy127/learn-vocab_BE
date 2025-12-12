import { Response } from 'express';

export interface FieldError {
  field: string;
  error_code: string;
}

export interface IResponse<T> {
  success: boolean;
  message_code: string | null;
  data: T | null;
  messages: FieldError[];
}

export function sendResponse<T>(
  res: Response,
  {
    status = 200,
    success = true,
    data = null,
    message_code = null,
    messages = [],
  }: {
    status?: number;
    success?: boolean;
    data?: T | null;
    message_code?: string | null;
    messages?: FieldError[];
  },
): Response<IResponse<T>> {
  return res.status(status).json({
    success,
    message_code,
    data,
    messages,
  });
}

export interface IListResponse<T> {
  success: boolean;
  message_code: string | null;
  messages: FieldError[];
  data: {
    data: T | null;
    pagination: {
      total: number;
      page: number;
      size: number;
      totalPages: number;
    };
  };
}

export function sendListResponse<T>(
  res: Response,
  {
    status = 200,
    success = true,
    data = null,
    message_code = null,
    messages = [],
    pagination = {
      total: 0,
      page: 1,
      size: 10,
      totalPages: 1,
    },
  }: {
    status?: number;
    success?: boolean;
    data?: T | null;
    message_code?: string | null;
    messages?: FieldError[];
    pagination?: {
      total: number;
      page: number;
      size: number;
      totalPages: number;
    };
  },
): Response<IListResponse<T>> {
  return res.status(status).json({
    success,
    message_code,
    messages,
    data: {
      data,
      pagination,
    },
  });
}
