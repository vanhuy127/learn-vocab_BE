import db from '@/config/prisma.config';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {
  generateAccessToken,
  generateRefreshToken,
  sendResponse,
  sendEmail,
  MAIL_OPTIONS,
  REFRESH_TOKEN_EXPIRY,
} from '@/utils';
import { MESSAGE_CODES } from '@/constants';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema } from '@/validations';
import { addMinutes } from 'date-fns';
import crypto from 'crypto';

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });

      return;
    }

    const { email, password, userName } = parsed.data;
    const normalizedEmail = email.trim();

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      sendResponse(res, {
        status: 409,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.EMAIL_ALREADY_EXISTS,
      });

      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        userName: userName.trim(),
      },
    });

    sendResponse(res, {
      status: 201,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.CREATED_SUCCESS,
    });
  } catch (error) {
    console.error('Error during user registration:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });

      return;
    }

    const { email, password } = parsed.data;

    const user = await db.user.findFirst({
      where: { email: email.trim() },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.INVALID_CREDENTIALS,
      });

      return;
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip || 'unknown',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY), // 7 ngày
      },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY,
    });

    const resData = { id: user.id, email: user.email, role: user.role, userName: user.userName, accessToken };

    sendResponse(res, {
      status: 200,
      success: true,
      data: resData,
      message_code: MESSAGE_CODES.SUCCESS.LOGIN_SUCCESS,
    });
  } catch (error) {
    console.error('Error during user authorization:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });

    return;
  }
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.REFRESH_TOKEN_MISSING,
      });

      return;
    }

    const rf = await db.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!rf) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.INVALID_REFRESH_TOKEN,
      });
      return;
    }

    // Kiểm tra nếu token đã hết hạn
    if (rf.expiresAt < new Date()) {
      await db.refreshToken.delete({ where: { token } });

      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.REFRESH_TOKEN_EXPIRED,
      });
      return;
    }

    const newAccessToken = generateAccessToken({
      id: rf.user.id,
      email: rf.user.email,
      userName: rf.user.userName,
      role: rf.user.role,
    });

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.REFRESH_TOKEN_SUCCESS,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const { id } = req.user;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        userName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });

      return;
    }

    sendResponse(res, {
      status: 200,
      success: true,
      data: user,
      message_code: MESSAGE_CODES.SUCCESS.GET_SUCCESS,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });

      return;
    }

    const { newPassword } = parsed.data;

    const { id } = req.user;

    const existingUser = await db.user.findUnique({
      where: {
        id,
      },
    });

    if (!existingUser) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });

      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await db.user.update({
      where: {
        id,
      },
      data: {
        password: hashedPassword,
      },
    });

    if (updatedUser) {
      sendResponse(res, {
        status: 200,
        success: true,
        data: { email: updatedUser.email },
        message_code: MESSAGE_CODES.SUCCESS.UPDATED_SUCCESS,
      });
    }
  } catch (error) {
    console.log(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.AUTH.REFRESH_TOKEN_MISSING,
      });

      return;
    }

    await db.refreshToken.delete({
      where: {
        token,
      },
    });

    res.clearCookie('refreshToken');

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.LOGOUT_SUCCESS,
    });
  } catch (error) {
    console.error('Error during logout:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const sendEmailForgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });
      return;
    }

    const { email } = parsed.data;

    const user = await db.user.findFirst({
      where: { email },
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const resetPwToken = crypto.randomBytes(32).toString('hex');
    const resetPwExpireAt = addMinutes(new Date(), 30);

    const resetLink = `${process.env.FRONT_END_URL}/reset-password/${resetPwToken}`;
    await sendEmail(
      user.email,
      'Password Reset Request',
      MAIL_OPTIONS.FORGOT_PASSWORD(resetLink, resetPwExpireAt.toLocaleString()),
    );

    await db.user.update({
      where: { id: user.id },
      data: {
        resetPwToken,
        resetPwExpireAt,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.PASSWORD_RESET_EMAIL_SENT,
      data: { email, resetPwToken },
    });
  } catch (error) {
    console.error('Error during forgot password:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const checkTokenAvailable = async (req: Request, res: Response) => {
  try {
    const token = req.params.token;

    if (!token) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    const user = await db.user.findFirst({
      where: { resetPwToken: token },
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (user.resetPwExpireAt && user.resetPwExpireAt < new Date()) {
      sendResponse(res, {
        status: 410,
        success: false,
        message_code: MESSAGE_CODES.AUTH.INVALID_OR_EXPIRED_TOKEN,
      });
      return;
    }

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.GET_SUCCESS,
      data: { email: user.email },
    });
  } catch (error) {
    console.error('Error during forgot password:', error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    const user = await db.user.findFirst({
      where: {
        resetPwToken: token,
        resetPwExpireAt: { gte: new Date() },
      },
    });

    if (!user) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.AUTH.INVALID_OR_EXPIRED_TOKEN,
      });

      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPwToken: null,
        resetPwExpireAt: null,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.UPDATED_SUCCESS,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const tokenRecovery = async (req: Request, res: Response) => {
  try {
    const token = req.params.token;

    if (!token) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.AUTH.TOKEN_REQUIRED,
      });
      return;
    }

    const refreshToken = await db.refreshToken.findUnique({
      where: {
        token,
      },
    });

    if (!refreshToken) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    await db.refreshToken.delete({
      where: {
        id: refreshToken.id,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.DELETED_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};
