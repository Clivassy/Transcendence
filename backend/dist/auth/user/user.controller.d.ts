import { UserNameDto } from "./dto";
import { UserService } from "./user.service";
import { User } from "@prisma/client";
import { AuthService } from "../auth.service";
export declare class UserController {
    private readonly userService;
    private authService;
    constructor(userService: UserService, authService: AuthService);
    updateUsername(authorizationHeader: string, usernameDto: UserNameDto): Promise<void>;
    getUserById(userId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        username: string;
        isLogged: boolean;
        inChat: boolean;
        inGame: boolean;
        gamesWon: number;
        gamesLost: number;
        score: number;
        userSecret: string;
        firstLogin: boolean;
        avatarId: number;
        IstwoFactorAuth: boolean;
        IsSigninWith42: boolean;
        hash: string;
        hashedRt: string;
        blockedIds: number[];
        achievementChat: boolean;
        achievementPong: boolean;
        achievementAvatar: boolean;
    }>;
    getUsersList(): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        username: string;
        isLogged: boolean;
        inChat: boolean;
        inGame: boolean;
        gamesWon: number;
        gamesLost: number;
        score: number;
        userSecret: string;
        firstLogin: boolean;
        avatarId: number;
        IstwoFactorAuth: boolean;
        IsSigninWith42: boolean;
        hash: string;
        hashedRt: string;
        blockedIds: number[];
        achievementChat: boolean;
        achievementPong: boolean;
        achievementAvatar: boolean;
    }[]>;
    getFriends(authorizationHeader: string): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        username: string;
        isLogged: boolean;
        inChat: boolean;
        inGame: boolean;
        gamesWon: number;
        gamesLost: number;
        score: number;
        userSecret: string;
        firstLogin: boolean;
        avatarId: number;
        IstwoFactorAuth: boolean;
        IsSigninWith42: boolean;
        hash: string;
        hashedRt: string;
        blockedIds: number[];
        achievementChat: boolean;
        achievementPong: boolean;
        achievementAvatar: boolean;
    }[]>;
    getNonFriends(authorizationHeader: string): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        username: string;
        isLogged: boolean;
        inChat: boolean;
        inGame: boolean;
        gamesWon: number;
        gamesLost: number;
        score: number;
        userSecret: string;
        firstLogin: boolean;
        avatarId: number;
        IstwoFactorAuth: boolean;
        IsSigninWith42: boolean;
        hash: string;
        hashedRt: string;
        blockedIds: number[];
        achievementChat: boolean;
        achievementPong: boolean;
        achievementAvatar: boolean;
    }[]>;
    addFriend(authorizationHeader: string, friendData: {
        friendId: number;
    }): Promise<boolean>;
    deleteFriend(friendData: {
        friendId: number;
    }, authorizationHeader: string): Promise<boolean>;
    getUsersSortedByScore(): Promise<User[]>;
}