import {
  Controller,
  Post,
  Headers,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Query,
  Put,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { signupDto, SigninDto } from "./dto";
import { Tokens, signinResponse } from "./types";
import { User } from "@prisma/client";

interface Response {
  [x: string]: any;
  tokens: Tokens;
  user: User;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("local/signup")
  @HttpCode(HttpStatus.CREATED)
  async signupLocal(@Body() signupDto: signupDto): Promise<User> {
    try {
      const user: User = await this.authService.signupLocal(signupDto);
      return user;
    } catch (error) {
      return error;
    }
  }

  @Post("local/signin")
  @HttpCode(HttpStatus.OK)
  async signinLocal(@Body() SigninDto: SigninDto): Promise<signinResponse> {
    const response: signinResponse =
      await this.authService.signinLocal(SigninDto);
    return response;
  }
  @Get("local/signinExtern")
  async signinExtern(@Res() res): Promise<string> {
    try {
      const authorizationUrl = await this.authService.signin42API();
      res.redirect(302, authorizationUrl);
      return authorizationUrl;
    } catch (error) {
      console.error("Error during redirection:", error);
      throw error;
    }
  }

  @Get("local/handleCallback")
  async handleCallback(@Query("code") code: string, @Res() res: Response) {
    try {
      const accessToken: string = await this.authService.getAccessToken(code);
      const tokens: Tokens =
        await this.authService.create42UserSession(accessToken);

      res.redirect(
        // `http://localhost:3333/auth/login?accessToken=${tokens.access_token}&refreshToken=${tokens.refresh_token}`
        `${process.env.PUBLIC_FRONT_URL}/auth/login?accessToken=${tokens.access_token}&refreshToken=${tokens.refresh_token}`
      );
      return tokens;
    } catch (error) {
      return res.status(500).json({ message: "Une erreur est survenue" });
    }
  }

  @Get("getMe")
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Headers("authorization") authorizationHeader: string
  ): Promise<Response> {
    const user: User = await this.authService.getMe(authorizationHeader);
    const tokens = authorizationHeader.substring(7).split(",");
    const accessToken = tokens[0].trim();
    const refreshToken = tokens[1].trim();
    const response: Response = {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      user,
    };
    return response;
  }

  @Put("activate2FA")
  @HttpCode(HttpStatus.OK)
  async activate2FA(
    @Headers("authorization") authorizationHeader: string
  ): Promise<boolean> {
    const user: User = await this.authService.getMe(authorizationHeader);
    try {
      return this.authService.activate2FA(user);
    } catch (error) {
      return null;
    }
  }

  @Get("get2FACode")
  @HttpCode(HttpStatus.OK)
  async get2FACode(
    @Headers("authorization") authorizationHeader: string
  ): Promise<string> {
    const user: User = await this.authService.getUser2FA(authorizationHeader);
    const qrCodeUrl = await this.authService.generate2FAsecret(user.id);
    return qrCodeUrl;
  }
  @Post("validate2FACode")
  @HttpCode(HttpStatus.OK)
  async validate2FACode(
    @Headers("authorization") authorizationHeader: string,
    @Body("validationCode") validationCode: string
  ): Promise<boolean> {
    const user: User = await this.authService.getUser2FA(authorizationHeader);
    return this.authService.validate2FACode(user.id, validationCode);
  }

  @Post("verify2FACode")
  @HttpCode(HttpStatus.OK)
  async verify2FACode(
    @Headers("authorization") authorizationHeader: string,
    @Body("validationCode") validationCode: string
  ): Promise<boolean> {
    const user: User = await this.authService.getUser2FA(authorizationHeader);
    return this.authService.verify2FACode(user.id, validationCode);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Headers("authorization") authorizationHeader: string) {
    const user: User = await this.authService.getMe(authorizationHeader);
    try {
      this.authService.logout(user.id);
    } catch (error) {
      return null;
    }
  }

  @Post("firstLogin")
  async setFirstLoginFalse(
    @Headers("authorization") authorizationHeader: string
  ): Promise<User> {
    const user: User = await this.authService.getMe(authorizationHeader);

    if (user) {
      const updatedUser = await this.authService.setFirstLoginFalse(user.id);
      return updatedUser;
    } else {
      return null;
    }
  }
}
