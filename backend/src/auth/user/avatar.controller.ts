import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Headers,
  Param,
  NotFoundException,
  Res,
  InternalServerErrorException,
  BadRequestException,
} from "@nestjs/common";
import { extname } from "path";
import { Readable } from "stream";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserService } from "./user.service";
import { Avatar, User } from "@prisma/client";
import { AuthService } from "../auth.service";
import { AvatarService } from "./avatar.service";
import { Express } from "express";
import { PrismaService } from "src/prisma/prisma.service";

const maxFileSizeInMegabytes = 5;
@Controller("avatar")
export class AvatarController {
  constructor(
    private readonly userService: UserService,
    private authService: AuthService,
    private avatarService: AvatarService,
    private prisma: PrismaService
  ) {}

  @Post("uploadAvatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      limits: {
        fileSize: maxFileSizeInMegabytes * 1024 * 1024,
      },
    })
  )
  async uploadAvatar(
    @Headers("authorization") authorizationHeader: string,
    @UploadedFile() avatar: Express.Multer.File
  ) {
    try {
      const user: User = await this.authService.getMe(authorizationHeader);
      if (
        extname(avatar.originalname) !== ".jpeg" &&
        extname(avatar.originalname) !== ".jpg"
      ) {
        throw BadRequestException;
      }
      if (user.achievementAvatar == false && user.avatarId == null) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            achievementAvatar: true,
          },
        });
      }
      const uniqueFileName = await this.avatarService.generateUniqueFileName(
        avatar.originalname
      );

      const newAvatar = await this.avatarService.createAvatar(
        uniqueFileName,
        avatar.buffer,
        user.id
      );
      await this.userService.updateAvatar(user.id, user.username, newAvatar);
      return newAvatar.id;
    } catch (error) {
      throw new InternalServerErrorException("Error: can't download avatar.");
    }
  }

  @Get("getAvatar/:id")
  async getAvatar(@Param("id") id: string): Promise<Avatar> {
    const avatarId: number = parseInt(id);
    const avatar = await this.avatarService.getAvatarData(avatarId);
    return avatar;
  }

  // Function to print avatar from URL sent
  // return avatar from id
  // front need to send avatar id of the user
  @Get("data/:id")
  async getAvatarData(@Param("id") id: string, @Res() res: Response) {
    try {
      const avatarId: number = parseInt(id);
      const avatar = await this.avatarService.getAvatarData(avatarId);
      if (!avatar || !avatar.data) {
        throw new NotFoundException("Error: avatar not found");
      }
      /*       const avatarURL = await this.avatarService.generateAvatarURL(avatar.id);

      const imageStream = new Readable({
        read() {
          this.push(avatar.data);
          this.push(null);
        },
      });*/
      res.send(avatar.data);
    } catch (error) {
      //console.log("Error");
    }
  }
}
