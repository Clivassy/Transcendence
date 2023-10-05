import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Avatar } from "@prisma/client";
import * as crypto from "crypto";
import * as path from "path";

@Injectable()
export class AvatarService {
  constructor(private prisma: PrismaService) {}
  async createAvatar(
    fileName: string,
    data: Buffer,
    userId: number
  ): Promise<Avatar> {
    const newAvatar = await this.prisma.avatar.create({
      data: {
        filename: fileName,
        data: data,
        userId: userId,
      },
    });
    return newAvatar;
  }

  async generateUniqueFileName(originalFileName: string): Promise<string> {
    const timestamp = new Date().getTime();
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const fileExtension = path.extname(originalFileName);
    const uniqueFileName = `${timestamp}-${uniqueId}${fileExtension}`;
    return uniqueFileName;
  }

  async getAvatarData(id: number): Promise<Avatar | null> {
    return this.prisma.avatar.findUnique({ where: { id: id } });
  }

  async generateAvatarURL(avatarId: number): Promise<string> {
    const avatar = await this.prisma.avatar.findUnique({
      where: { id: avatarId },
    });

    if (!avatar) {
      throw new NotFoundException("Avatar not found");
    }
    const avatarURL = `http://${process.env.PUBLIC_API_URL}/avatar/data/${avatar.id}`;
    return avatarURL;
  }

  async deleteAvatar(avatarId: number) {
    await this.prisma.avatar.delete({
      where: {
        id: avatarId,
      },
    });
  }
}
