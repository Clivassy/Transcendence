import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UserNameDto } from "./dto";
import { Avatar, User } from "@prisma/client";

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  async updateUsername(
    userId: number,
    lastUsername: string,
    UsernameDto: UserNameDto
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const incomingUser = await this.prisma.user.findUnique({
      where: { username: lastUsername },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    const existingUsernameUser = await this.prisma.user.findUnique({
      where: { username: UsernameDto.username },
    });

    if (existingUsernameUser) {
      throw new ConflictException(
        `Username ${UsernameDto.username} already exists.`
      );
    }

    if (incomingUser.username !== existingUser.username) {
      throw new UnauthorizedException(
        "You are not allowed to change the username."
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { username: UsernameDto.username },
    });
  }

  async updateAvatar(userId: number, lastUsername: string, avatar: Avatar) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const incomingUser = await this.prisma.user.findUnique({
      where: { username: lastUsername },
    });
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    if (incomingUser.username !== existingUser.username) {
      throw new UnauthorizedException(
        "You are not allowed to change the username."
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: { connect: { id: avatar.id } } },
    });
    return updatedUser.id;
  }

  async getUsersList() {
    return this.prisma.user.findMany();
  }

  async getUserById(id: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: Number(id), // Remplacez 1 par l'ID que vous souhaitez rechercher
        },
      });
      if (user) return user;
      else return null;
    } catch (error) {
      return null;
    }
  }

  async getNonFriends(userId: number) {
    // Get the IDs of the user's friends
    const userFriends = await this.prisma.friends.findMany({
      where: {
        userId: userId,
      },
      select: {
        friendId: true,
      },
    });

    const friendIds = userFriends.map((friend) => friend.friendId);

    const nonFriends = await this.prisma.user.findMany({
      where: {
        NOT: {
          id: {
            in: [...friendIds, userId],
          },
        },
      },
    });

    return nonFriends;
  }

  async getFriends(userId: number) {
    const userFriends = await this.prisma.friends.findMany({
      where: {
        userId: userId,
      },
      select: {
        friendId: true,
      },
    });

    const friendIds = userFriends.map((friend) => friend.friendId);

    const friends = await this.prisma.user.findMany({
      where: {
        id: {
          in: friendIds,
        },
      },
    });

    return friends;
  }

  async addFriend(userId: number, friendId: number) {
    try {
      const existingFriend = await this.prisma.friends.findFirst({
        where: {
          userId: userId,
          friendId: friendId,
        },
      });

      if (existingFriend) {
        return false;
      }

      await this.prisma.friends.create({
        data: {
          userId: userId,
          friendId: friendId,
        },
      });

      const friend = await this.prisma.user.findUnique({
        where: {
          id: friendId,
        },
      });

      if (!friend) {
        throw new Error("Friend does not exist.");
      }
      const friendUsername = friend.username;
      return true;
    } catch (error) {
      throw new Error("Erreur lors de l'ajout d'ami : " + error.message);
    }
  }

  async deleteFriend(userId: number, friendId: number): Promise<boolean> {
    try {
      const existingFriend = await this.prisma.friends.findFirst({
        where: {
          userId: userId,
          friendId: friendId,
        },
      });

      if (!existingFriend) {
        return false;
      }

      await this.prisma.friends.delete({
        where: {
          id: existingFriend.id,
        },
      });

      return true;
    } catch (error) {
      throw new Error(
        "Erreur lors de la suppression de l'ami : " + error.message
      );
    }
  }

  async getUsersSortedByScore(): Promise<User[]> {
    const usersSortedByScore = await this.prisma.user.findMany({
      orderBy: {
        score: "desc",
      },
    });
    return usersSortedByScore;
  }
}
