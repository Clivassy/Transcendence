import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AtStrategy, RtStrategy } from "../strategies";
import * as jwt from "jsonwebtoken";
import { JwtPayload } from "../types";
import { AuthService } from "../auth.service";

@Injectable()
export class RefreshTokenMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly atStrategy: AtStrategy,
    private readonly rtStrategy: RtStrategy
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
      res
        .status(200)
        .json({ message: "Middleware bypassed : missing AuthorizationHeader" });
    }

    if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
      const tokens = authorizationHeader.substring(7).split(",");
      const accessToken = tokens[0].trim();
      const refreshToken = tokens[1].trim();

      if (refreshToken !== "null") {
        try {
          const decodedToken = jwt.decode(accessToken) as JwtPayload;
          try {
            const rtUser = await this.rtStrategy.validate(req, decodedToken);
          } catch {
            return null;
          }
          if (decodedToken && this.atStrategy.validate(decodedToken)) {
          } else {
            const userId: number = parseInt(decodedToken.sub, 10);
            const newAccessToken = await this.authService.refreshTokens(
              userId,
              refreshToken
            );
            const newAuthorizationHeader = `Bearer ${[
              newAccessToken.access_token,
              newAccessToken.refresh_token,
            ].join(", ")}`;

            req.headers.authorization = newAuthorizationHeader;
          }
        } catch (error) {
          console.log("Error occurred while regenerating Access Token:", error);
        }
      } else {
      }
      next();
    }
  }
}
