import {
  Injectable,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import * as argon from "argon2";
import * as jwt from "jsonwebtoken";
import axios from "axios";
import { PrismaService } from "src/prisma/prisma.service";
import { signupDto, SigninDto } from "./dto";
import { Tokens, JwtPayload, signinResponse } from "./types";
import { AtStrategy } from "./strategies";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly atStrategy: AtStrategy
  ) {}

  /* -------------------------------------------------------------------------------------------------------
  Logique globale de cette fonction :
  -- Crée un nouvel utilisateur dans la base de données en utilisant Prisma (envoi de l'email + mdp hashé)
  -- Génère les tokens d'authentification pour cet utilisateur (getTokens : access token + refresh token)
  -- Mettre à jour le hash du jeton de rafraîchissement (updateRtHash)
  -- Renvoyer les tokens générés (return tokens) 
  ---------------------------------------------------------------------------------------------------------*/
  async signupLocal(signupDto: signupDto): Promise<User> {
    try {
      const existingUserWithEmail = await this.prisma.user.findUnique({
        where: {
          email: signupDto.email,
        },
      });

      if (existingUserWithEmail) {
        throw new ConflictException("Email already in use");
      }
      const existingUserWithUsername = await this.prisma.user.findUnique({
        where: {
          username: signupDto.username,
        },
      });

      if (existingUserWithUsername) {
        throw new ConflictException("Username already in use");
      }

      const hash = await this.hashData(signupDto.password);

      const newUser = await this.prisma.user.create({
        data: {
          email: signupDto.email,
          isLogged: false,
          avatarId: null,
          inChat: false,
          inGame: false,
          IstwoFactorAuth: false,
          IsSigninWith42: false,
          username: signupDto.username,
          hash,
        },
      });
      return newUser;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      } else {
        throw new InternalServerErrorException("Internal server error");
      }
    }
  }

  async signinLocal(SigninDto: SigninDto): Promise<signinResponse> {
    let twoFA: boolean;
    const user = await this.prisma.user.findUnique({
      where: {
        email: SigninDto.email,
      },
    });
    if (!user) throw new ForbiddenException("User Does Not Exist");

    const passwordMatches = await argon.verify(user.hash, SigninDto.password);
    if (!passwordMatches) throw new ForbiddenException("Wrong Password");

    if (user.IstwoFactorAuth == false) {
      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          isLogged: true,
        },
      });
    }
    const tokens = await this.getTokens(user.id, user.email);
    this.updateRtHash(user.id, tokens.refresh_token);
    if (user.IstwoFactorAuth) {
      twoFA = true;
    } else {
      twoFA = false;
    }
    const response: signinResponse = {
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
      is2FA: twoFA,
    };
    return response;
  }

  /*----------------------------------------------
    Authentication 2FA
  ----------------------------------------------- */
  async activate2FA(user: User): Promise<boolean> {
    if (String(user) === null) return false;
    if (user.IstwoFactorAuth == true) {
      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          IstwoFactorAuth: false,
          userSecret: null,
        },
      });
      return false;
    } else {
      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          IstwoFactorAuth: true,
        },
      });
      return true;
    }
  }

  async validate2FACode(
    userId: number,
    validationCode: string
  ): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new Error("User Does Not Exist");
      }

      const secret = user.userSecret;
      const speakeasy = require("speakeasy");

      const isValidCode = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: validationCode,
      });

      if (isValidCode) {
        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            isLogged: true,
          },
        });
        return true;
      } else {
        throw new Error("Validation code is incorrect");
      }
    } catch (error) {
      console.log("error: ", error);
      return false;
    }
  }

  async verify2FACode(
    userId: number,
    validationCode: string
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error("User Does Not Exist");
    }
    const secret = user.userSecret;
    let code = "";
    return import("speakeasy").then((speakeasy) => {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: validationCode,
      });
      if (verified) {
        return true;
      } else {
        return this.prisma.user
          .update({
            where: {
              id: userId,
            },
            data: {
              userSecret: null,
            },
          })
          .then(() => {
            return false;
          });
      }
    });
  }

  async generate2FAsecret(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    const speakeasy = require("speakeasy");
    const qrcode = require("qrcode");

    const tempSecret = speakeasy.generateSecret({
      name: process.env.SPEAKEASY_SECRET,
    });
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        userSecret: tempSecret.base32,
      },
    });
    const qrCodeUrl = await new Promise<string>((resolve, reject) => {
      qrcode.toDataURL(tempSecret.otpauth_url, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    return qrCodeUrl;
  }

  async getUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get("https://api.intra.42.fr/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }

  async getAccessToken(code: string): Promise<string | null> {
    try {
      const clientId = process.env.CLIENT_ID;
      const clientSecret = process.env.CLIENT_SECRET;
      const redirectUri = process.env.REDIRECT_URI;
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64"
      );

      const response = await axios.post(
        "https://api.intra.42.fr/oauth/token",
        {
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      if (response.data && response.data.access_token) {
        return response.data.access_token;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du jeton d'accès:", error);
      return null;
    }
  }

  // here implementer la logique d'authentification via 42 API
  // 1- je vais récupérer les infos par appel à l'API 42
  // Je stocke les infos :
  // 2- si le user n'existe pas je créé un user dans ma database
  // si le user existe, je passe a l'étape suivante
  // J'active le boolean is42signin = true
  // Je check si la 2FA est true == auquel cas j'appelle ma logique de 2FA
  // Je renvoie les tokens au front.
  async create42UserSession(accessToken: string): Promise<Tokens> {
    const tokenResponse: Tokens = {
      access_token: accessToken,
      refresh_token: null,
    };

    const userInfo = await this.getUserInfo(accessToken);
    const user = await this.prisma.user.findUnique({
      where: {
        email: userInfo.email,
      },
    });

    if (!user) {
      const newUser = await this.prisma.user.create({
        data: {
          email: userInfo.email,
          avatarId: null,
          isLogged: true,
          inChat: false,
          inGame: false,
          IstwoFactorAuth: false,
          IsSigninWith42: true,
          username: userInfo.login,
          hashedRt: accessToken,
        },
      });
      const avatar = await this.prisma.avatar.create({
        data: {
          filename: "small_student.jpg",
          data: Buffer.from(userInfo.image.versions.small),
          url42: userInfo.image.versions.small,
          userId: newUser.id,
        },
      });
      await this.prisma.user.update({
        where: { id: newUser.id },
        data: {
          avatarId: avatar.id,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          hashedRt: accessToken,
          isLogged: true,
        },
      });
    }
    return tokenResponse;
  }

  async signin42API(): Promise<string> {
    try {
      const clientId = process.env.CLIENT_ID;
      const redirectUri = process.env.REDIRECT_URI;
      const authorizationEndpoint = process.env.AUTHORIZATION_ENDPOINT;

      const queryParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        grant_type: "authorization_code",
      });

      const authorizationUrl = `${authorizationEndpoint}?${queryParams.toString()}`;

      return authorizationUrl;
    } catch (error) {
      console.error("Error during authorization:", error);
      throw error;
    }
  }

  /*---------------------------------------
    LOGOUT 
  ---------------------------------------*/
  async logout(userId: number) {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRt: {
          not: null,
        },
      },
      data: {
        hashedRt: null,
        isLogged: false,
      },
    });
  }

  /*---------------------------------------
    REFRESH TOKENS 
  ---------------------------------------*/
  async refreshTokens(userId: number, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user || !user.hashedRt)
      throw new ForbiddenException("Access Denied 1");
    const rtMatches = await argon.verify(user.hashedRt, rt);
    if (!rtMatches) throw new ForbiddenException("Access Denied 2");
    const tokens = await this.getTokens((await user).id, (await user).email);
    this.updateRtHash((await user).id, tokens.refresh_token);
    return tokens;
  }

  //--------------------------------
  //-- UTILS FUNCTIONS -------------
  //--------------------------------
  hashData(data: string) {
    return argon.hash(data);
  }

  async getUser2FA(authorizationHeader: string): Promise<User> {
    if (!authorizationHeader) return;
    const tokens = authorizationHeader.substring(7).split(",");
    const accessToken = tokens[0].trim();
    const refreshToken = tokens[1].trim();

    if (refreshToken === "null") {
      const hashToken = await this.hashData(accessToken);

      const userAPI = await this.prisma.user.findUnique({
        where: {
          hashedRt: accessToken,
        },
      });
      return userAPI;
    }

    try {
      const userPayload = await this.parseToken(authorizationHeader);
      const user = await this.prisma.user.findUnique({
        where: {
          email: userPayload.email,
        },
      });
      return user;
    } catch (error) {
      console.log("error GetMe");
      return null;
    }
  }

  async getMe(authorizationHeader: string): Promise<User> {
    if (!authorizationHeader) return;
    const tokens = authorizationHeader.substring(7).split(",");
    const accessToken = tokens[0].trim();
    const refreshToken = tokens[1].trim();

    try {
      if (refreshToken === "null") {
        const hashToken = await this.hashData(accessToken);

        const userAPI = await this.prisma.user.findUnique({
          where: {
            hashedRt: accessToken,
          },
        });

        if (userAPI.isLogged) {
          return userAPI;
        } else {
          return null;
        }
      }
    } catch (error) {
      return null;
    }

    try {
      const userPayload = await this.parseToken(authorizationHeader);
      const user = await this.prisma.user.findUnique({
        where: {
          email: userPayload.email,
        },
      });
      if (user.isLogged) {
        return user;
      } else {
        return null;
      }
    } catch (error) {
      console.log("error GetMe");
      return null;
    }
  }

  async updateRtHash(userId: number, rt: string) {
    const hash = await this.hashData(rt);
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        hashedRt: hash,
      },
    });
  }

  async getTokens(userId: number, email: string): Promise<Tokens> {
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = currentTime + 60 * 60 * 24 * 7;

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          exp: expirationTime,
        },
        {
          secret: process.env.AT_SECRET,
        }
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: process.env.RT_SECRET,
          expiresIn: 60 * 60 * 24 * 7,
        }
      ),
    ]);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  async parseToken(authorizationHeader: string): Promise<JwtPayload> {
    if (!authorizationHeader) return;
    const tokens = authorizationHeader.substring(7).split(",");
    const accessToken = tokens[0].trim();

    try {
      const decodedToken = jwt.verify(
        accessToken,
        process.env.AT_SECRET
      ) as JwtPayload;
      const userPayload = this.atStrategy.validate(decodedToken);
      return userPayload;
    } catch (error) {
      console.log("Error ParseToken : Can't find user");
      return null;
    }
  }

  async setFirstLoginFalse(userId: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { firstLogin: false },
    });
  }
}
