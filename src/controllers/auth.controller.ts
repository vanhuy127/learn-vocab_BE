import db from '@/config/prisma.config';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sendResponse,
  sendEmail,
  MAIL_OPTIONS,
} from '@/utils';
import { MESSAGE_CODES } from '@/constants';
import { changePasswordSchema, forgotPasswordSchema, loginSchema } from '@/validations';
import { addMinutes } from 'date-fns';
import crypto from 'crypto';

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

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
    });

    // await db.refreshToken.create({
    //   data: {
    //     userId: user.id,
    //     token: refreshToken,
    //     userAgent: req.headers['user-agent'] || 'unknown',
    //     ipAddress: req.ip || 'unknown',
    //     expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 ngày
    //   },
    // });

    const resData = { id: user.id, email: user.email, role: user.role, userName: user.userName };

    sendResponse(res, {
      status: 200,
      success: true,
      data: { ...resData, accessToken, refreshToken },
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
    const token = req.body.refreshToken;
    if (!token) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.REFRESH_TOKEN_MISSING,
      });

      return;
    }

    const { decoded, error } = verifyRefreshToken(token);

    if (error) {
      const errorCode =
        error === 'TOKEN_EXPIRED' ? MESSAGE_CODES.AUTH.REFRESH_TOKEN_EXPIRED : MESSAGE_CODES.AUTH.INVALID_REFRESH_TOKEN;

      // if (error === 'TOKEN_EXPIRED') {
      //   await db.refreshToken.updateMany({
      //     where: {
      //       token,
      //       isRevoked: false,
      //     },
      //     data: {
      //       isRevoked: true,
      //     },
      //   });
      // }

      sendResponse(res, {
        status: 401,
        success: false,
        message_code: errorCode,
      });

      return;
    }

    if (!decoded || !decoded.id || !decoded.email || !decoded.role) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.AUTH.INVALID_TOKEN,
      });

      return;
    }

    // const storedToken = await db.refreshToken.findFirst({
    //   where: {
    //     token,
    //     userId: decoded.id,
    //     isRevoked: false,
    //   },
    // });

    // if (!storedToken) {
    //   // Revoke tất cả refresh token của user (nghi ngờ token bị đánh cắp)
    //   await db.refreshToken.updateMany({
    //     where: {
    //       userId: decoded.id,
    //       isRevoked: false,
    //     },
    //     data: {
    //       isRevoked: true,
    //     },
    //   });

    //   sendResponse(res, {
    //     status: 401,
    //     success: false,
    //     message_code: MESSAGE_CODES.AUTH.INVALID_REFRESH_TOKEN,
    //   });
    //   return;
    // }

    const newAccessToken = generateAccessToken({
      id: decoded.id,
      email: decoded.email,
      userName: decoded.userName,
      role: decoded.role,
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

// export const logout = async (req: Request, res: Response) => {
//   try {
//     const token = req.body.refreshToken;
//     const { id } = req.user;

//     if (!token) {
//       sendResponse(res, {
//         status: 400,
//         success: false,
//         message_code: MESSAGE_CODES.AUTH.REFRESH_TOKEN_MISSING,
//       });

//       return;
//     }

//     const storedToken = await db.refreshToken.findFirst({
//       where: {
//         token,
//         userId: id,
//         isRevoked: false,
//       },
//     });

//     if (!storedToken) {
//       // Token không tồn tại hoặc đã bị revoke rồi
//       // Vẫn trả về success để tránh leak thông tin
//       sendResponse(res, {
//         status: 200,
//         success: true,
//         message_code: MESSAGE_CODES.SUCCESS.LOGOUT_SUCCESS,
//       });
//       return;
//     }

//     await db.refreshToken.update({
//       where: {
//         id: storedToken.id,
//       },
//       data: {
//         isRevoked: true,
//       },
//     });

//     sendResponse(res, {
//       status: 200,
//       success: true,
//       message_code: MESSAGE_CODES.SUCCESS.LOGOUT_SUCCESS,
//     });
//   } catch (error) {
//     console.error('Error during logout:', error);
//     sendResponse(res, {
//       status: 500,
//       success: false,
//       message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
//     });
//   }
// };

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
