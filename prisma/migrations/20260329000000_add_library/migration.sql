-- AlterTable: add bookAccesses relation (no column needed, handled by BookAccess.userId FK)

-- CreateTable: Book
CREATE TABLE `Book` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `descriptionEn` TEXT NULL,
    `cover` VARCHAR(191) NOT NULL DEFAULT '',
    `filePath` VARCHAR(191) NOT NULL DEFAULT '',
    `totalPages` INTEGER NOT NULL DEFAULT 0,
    `freePages` INTEGER NOT NULL DEFAULT 10,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `author` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `allowQuoteShare` BOOLEAN NOT NULL DEFAULT true,
    `allowFriendShare` BOOLEAN NOT NULL DEFAULT true,
    `friendShareHours` INTEGER NOT NULL DEFAULT 48,
    `enableReferral` BOOLEAN NOT NULL DEFAULT true,
    `referralDiscount` INTEGER NOT NULL DEFAULT 20,
    `enableWatermark` BOOLEAN NOT NULL DEFAULT true,
    `enableForensic` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: BookAccess
CREATE TABLE `BookAccess` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `bookId` VARCHAR(191) NOT NULL,
    `lastPage` INTEGER NOT NULL DEFAULT 1,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BookAccess_userId_bookId_key`(`userId`, `bookId`),
    INDEX `BookAccess_bookId_idx`(`bookId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: BookShareLink
CREATE TABLE `BookShareLink` (
    `id` VARCHAR(191) NOT NULL,
    `bookId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BookShareLink_token_key`(`token`),
    INDEX `BookShareLink_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookAccess` ADD CONSTRAINT `BookAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BookAccess` ADD CONSTRAINT `BookAccess_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BookShareLink` ADD CONSTRAINT `BookShareLink_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
