import {
  Controller,
  Body,
  Put,
  Headers,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Delete,
} from "@nestjs/common";
import { UserNameDto } from "./dto";
import { UserService } from "./user.service";
import { User } from "@prisma/client";
import { AuthService } from "../auth.service";

@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private authService: AuthService
  ) {}

  @Put("updateUsername")
  @HttpCode(HttpStatus.OK)
  async updateUsername(
    @Headers("authorization") authorizationHeader: string,
    @Body() usernameDto: UserNameDto
  ) {
    const user: User = await this.authService.getMe(authorizationHeader);
    if (String(user) === "null") return;

    await this.userService.updateUsername(user.id, user.username, usernameDto);
  }

  @Get("getUserById/:userId")
  async getUserById(@Param("userId") userId: number) {
    return this.userService.getUserById(userId); // Pass userId to the service
  }

  @Get("list")
  async getUsersList() {
    return this.userService.getUsersList();
  }

  @Get("friends/getFriends")
  async getFriends(@Headers("authorization") authorizationHeader: string) {
    const user: User = await this.authService.getMe(authorizationHeader);
    if (String(user) === "null") return;

    return this.userService.getFriends(user.id);
  }

  @Get("friends/getNonFriends")
  async getNonFriends(@Headers("authorization") authorizationHeader: string) {
    const user: User = await this.authService.getMe(authorizationHeader);
    if (String(user) === "null") return;

    return this.userService.getNonFriends(user.id);
  }

  @Put("friends/addFriend")
  async addFriend(
    @Headers("authorization") authorizationHeader: string,
    @Body() friendData: { friendId: number }
  ) {
    const user: User = await this.authService.getMe(authorizationHeader);
    if (String(user) === "null") return;

    const friendId = friendData.friendId;
    return this.userService.addFriend(user.id, friendId);
  }

  @Delete("friends/deleteFriend")
  async deleteFriend(
    @Body() friendData: { friendId: number },
    @Headers("authorization") authorizationHeader: string
  ) {
    const user: User = await this.authService.getMe(authorizationHeader);
    if (String(user) === "null") return;

    const friendId = friendData.friendId;
    return this.userService.deleteFriend(user.id, friendId);
  }

  @Get("sortedByScore")
  async getUsersSortedByScore(): Promise<User[]> {
    const usersSortedByScore = await this.userService.getUsersSortedByScore();
    return usersSortedByScore;
  }
}
